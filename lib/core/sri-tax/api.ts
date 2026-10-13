import "@/lib/security/server-only";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { AppsoluxUser } from "@/types/user";
import { loadTaxSnapshot } from "./repository";
import { parseTaxPeriod, periodFromSearch, TaxInputError } from "./tax-period";
import { buildAtsPeriodData } from "./ats-data";
import { buildAtsSummary } from "./ats-summary";
import { buildAtsXml, validateAtsXsd } from "./ats-xml";
import { buildIva104Report, parseIvaManualInputs } from "./iva-104-report";
import {
  getReceivedSyncState,
  listReceivedDocuments,
  parseReceivedFilters,
  receivedAction,
} from "./received-documents";
import { buildSriTaxSummary } from "./sri-tax-summary";
import { validateTaxSnapshot } from "./tax-validations";
import {
  atsSummaryLines,
  ivaReportLines,
  ivaReportXlsx,
  taxReportPdf,
} from "./exports";

export type TaxEndpoint =
  | "summary"
  | "received"
  | "received-action"
  | "ats-preview"
  | "ats-xml"
  | "ats-summary"
  | "iva-104"
  | "validations";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const defaultServices = {
  getCurrentUser: async () => {
    const { getCurrentUser } = await import("@/lib/auth/current-user");
    return getCurrentUser();
  },
  getCurrentTenant: async (user: AppsoluxUser) => {
    const { getCurrentTenant } = await import("@/lib/tenant/current-tenant");
    return getCurrentTenant(user);
  },
  loadTaxSnapshot,
  listReceivedDocuments,
  getReceivedSyncState,
};
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: noStore });
}
function download(
  body: Uint8Array | string,
  type: string,
  filename: string,
  extra: Record<string, string> = {},
) {
  return new NextResponse(typeof body === "string" ? body : Buffer.from(body), {
    headers: {
      ...noStore,
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...extra,
    },
  });
}

export async function handleTaxRequest(
  req: NextRequest,
  endpoint: TaxEndpoint,
  dependencies: Partial<typeof defaultServices> = {},
) {
  const services = { ...defaultServices, ...dependencies };
  try {
    const user = await services.getCurrentUser();
    if (!user) return json({ error: "Sesión requerida." }, 401);
    const tenant = await services.getCurrentTenant(user);
    // tenantId is never read from query strings or request bodies.
    const params = req.nextUrl.searchParams;
    if (endpoint === "received")
      return json({
        ...(await services.listReceivedDocuments(
          tenant.id,
          parseReceivedFilters(params),
        )),
        sync: await services.getReceivedSyncState(tenant.id),
      });
    if (endpoint === "received-action") {
      const body: unknown = await req.json();
      if (
        !body ||
        typeof body !== "object" ||
        !("id" in body) ||
        !("action" in body) ||
        typeof body.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(body.id) ||
        typeof body.action !== "string"
      )
        throw new TaxInputError("Acción inválida.");
      let classification:
        { source: "INBOX" | "PURCHASE"; categoryId: string } | undefined;
      if (body.action === "classify") {
        if (
          !("source" in body) ||
          !["INBOX", "PURCHASE"].includes(String(body.source)) ||
          !("categoryId" in body) ||
          typeof body.categoryId !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(body.categoryId)
        )
          throw new TaxInputError("Categoría inválida.");
        classification = {
          source: body.source as "INBOX" | "PURCHASE",
          categoryId: body.categoryId,
        };
      }
      return json(
        await receivedAction(
          tenant.id,
          user.id,
          body.id,
          body.action,
          classification,
        ),
      );
    }
    const body =
      endpoint === "iva-104"
        ? ((await req.json()) as Record<string, unknown>)
        : null;
    if (
      endpoint === "iva-104" &&
      (!body || typeof body !== "object" || Array.isArray(body))
    )
      throw new TaxInputError("Solicitud inválida.");
    const period = body ? parseTaxPeriod(body) : periodFromSearch(params);
    const snapshot = await services.loadTaxSnapshot(tenant.id, period);
    if (endpoint === "summary")
      return json({
        ...buildSriTaxSummary(snapshot),
        sync: await services.getReceivedSyncState(tenant.id),
      });
    if (endpoint === "validations") {
      const severity = params.get("severity"),
        type = params.get("type");
      if (severity && !["ERROR", "WARNING", "INFO"].includes(severity))
        throw new TaxInputError("Severidad inválida.");
      if (
        type &&
        !["SALE", "PURCHASE", "RECEIVED", "PERIOD", "ATS"].includes(type)
      )
        throw new TaxInputError("Tipo de validación inválido.");
      const issues = [
        ...validateTaxSnapshot(snapshot),
        ...buildAtsPeriodData(snapshot).issues.filter((i) => i.type === "ATS"),
      ].filter(
        (i) =>
          (!severity || i.severity === severity) && (!type || i.type === type),
      );
      return json({ period, issues });
    }
    if (endpoint === "iva-104") {
      const report = buildIva104Report(
        snapshot,
        parseIvaManualInputs(body?.manualInputs),
      );
      if (body?.format === "pdf")
        return download(
          await taxReportPdf(ivaReportLines(report)),
          "application/pdf",
          `IVA104_${period.key}_Facturom.pdf`,
        );
      if (body?.format === "xlsx")
        return download(
          await ivaReportXlsx(report),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          `IVA104_${period.key}_Facturom.xlsx`,
        );
      if (body?.format !== undefined && body.format !== "json")
        throw new TaxInputError("Formato inválido.");
      return json(report);
    }
    const ats = buildAtsPeriodData(snapshot);
    let xml: string | null = null;
    if (ats.domainStatus === "DOMAIN_VALIDATION_OK") {
      xml = buildAtsXml(ats);
      ats.xmlStatus = "XML_GENERATED";
      const xsd = await validateAtsXsd(xml);
      ats.xsdStatus = xsd.status;
      if (xsd.status === "XSD_VALIDATION_ERROR")
        ats.issues.push({
          code: xsd.status,
          severity: "ERROR",
          type: "ATS",
          document: null,
          description:
            "El XML no cumple el esquema oficial. Revise los datos del informante.",
          action: "Corrija la información antes de exportar.",
          href: "/facturacion/configuration/sri",
        });
    }
    if (endpoint === "ats-xml") {
      if (!xml || ats.xsdStatus === "XSD_VALIDATION_ERROR")
        return json(
          {
            error: "Exportación ATS bloqueada. Revise las validaciones.",
            ...buildAtsSummary(ats),
          },
          422,
        );
      return download(
        xml,
        "application/xml; charset=utf-8",
        `ATS_${ats.company?.ruc}_${period.key}.xml`,
        {
          "X-ATS-Domain-Status": ats.domainStatus,
          "X-ATS-XSD-Status": ats.xsdStatus,
        },
      );
    }
    if (endpoint === "ats-summary") {
      if (params.get("format") === "pdf")
        return download(
          await taxReportPdf(atsSummaryLines(ats)),
          "application/pdf",
          `ATS_Resumen_${period.key}_Facturom.pdf`,
        );
      return json(buildAtsSummary(ats));
    }
    return json(ats);
  } catch (error) {
    if (
      error instanceof TaxInputError ||
      error instanceof SyntaxError ||
      error instanceof RangeError
    )
      return json({ error: error.message }, 400);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (["P2002", "P2034"].includes(error.code))
        return json(
          {
            error:
              "El documento ya existe o cambió durante la operación. Actualice la bandeja.",
          },
          409,
        );
      if (["P2021", "P2022"].includes(error.code))
        return json(
          {
            error:
              "Los datos de Compras aún no están disponibles en esta base. No se ejecutaron migraciones.",
          },
          503,
        );
    }
    console.error(
      "[sri-tax] Request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        error:
          "No se pudo completar el reporte tributario. Intente nuevamente.",
      },
      500,
    );
  }
}
