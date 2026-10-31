import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { parseReceivedTxt, isValidAccessKey } from "@/lib/core/sri-received-txt-parser";
import { fetchAuthorizedXml } from "@/lib/core/sri-soap-client";
import { importPurchaseXml } from "@/lib/core/purchase-xml-import";
import { getPrismaClient } from "@/lib/db/prisma";

const MAX_ROWS_PER_IMPORT = 50;
const DELAY_BETWEEN_SOAP_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const { user, tenant } = await requireDashboardSession();

  const contentType = req.headers.get("content-type") ?? "";

  let txtContent: string;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Archivo TXT requerido." },
        { status: 400 },
      );
    }
    const buffer = await file.arrayBuffer();
    try {
      const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
      txtContent = utf8Decoder.decode(buffer);
    } catch {
      const latin1Decoder = new TextDecoder("windows-1252");
      txtContent = latin1Decoder.decode(buffer);
    }
  } else if (contentType.includes("application/json")) {
    const body = await req.json();
    txtContent = body.txt;
    if (!txtContent) {
      return NextResponse.json(
        { ok: false, error: "Contenido TXT requerido." },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      { ok: false, error: "Content-Type no soportado." },
      { status: 415 },
    );
  }

  const rows = parseReceivedTxt(txtContent);

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No se encontraron filas válidas en el archivo TXT." },
      { status: 400 },
    );
  }

  if (rows.length > MAX_ROWS_PER_IMPORT) {
    return NextResponse.json(
      {
        ok: false,
        error: `El archivo contiene ${rows.length} filas. Máximo permitido: ${MAX_ROWS_PER_IMPORT}.`,
      },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId: tenant.id },
    select: { ruc: true },
  });
  const tenantRuc = profile?.ruc ?? null;

  const results: Array<{
    accessKey: string;
    emitterRuc: string;
    emitterName: string;
    documentType: string;
    status: "imported" | "already_exists" | "soap_failed" | "import_failed";
    error?: string;
  }> = [];

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!isValidAccessKey(row.accessKey)) {
      results.push({
        accessKey: row.accessKey,
        emitterRuc: row.emitterRuc,
        emitterName: row.emitterName,
        documentType: row.documentType,
        status: "import_failed",
        error: "Clave de acceso inválida.",
      });
      failed++;
      continue;
    }

    const existing = await prisma.purchaseDocument.findFirst({
      where: { tenantId: tenant.id, accessKey: row.accessKey },
      select: { id: true },
    });
    if (existing) {
      results.push({
        accessKey: row.accessKey,
        emitterRuc: row.emitterRuc,
        emitterName: row.emitterName,
        documentType: row.documentType,
        status: "already_exists",
      });
      skipped++;
      continue;
    }

    let xml: string | null = null;
    try {
      const soapResult = await fetchAuthorizedXml(row.accessKey);
      if (soapResult.authorized && soapResult.xml) {
        xml = soapResult.xml;
      } else {
        results.push({
          accessKey: row.accessKey,
          emitterRuc: row.emitterRuc,
          emitterName: row.emitterName,
          documentType: row.documentType,
          status: "soap_failed",
          error: soapResult.errors.join("; ") || `Estado: ${soapResult.status}`,
        });
        failed++;
        if (DELAY_BETWEEN_SOAP_MS > 0) await sleep(DELAY_BETWEEN_SOAP_MS);
        continue;
      }
    } catch {
      results.push({
        accessKey: row.accessKey,
        emitterRuc: row.emitterRuc,
        emitterName: row.emitterName,
        documentType: row.documentType,
        status: "soap_failed",
        error: "Error al consultar el servicio SOAP del SRI.",
      });
      failed++;
      continue;
    }

    try {
      const importResult = await importPurchaseXml(tenant.id, user.id, xml, tenantRuc);
      if (importResult.ok) {
        results.push({
          accessKey: row.accessKey,
          emitterRuc: row.emitterRuc,
          emitterName: row.emitterName,
          documentType: row.documentType,
          status: "imported",
        });
        imported++;
      } else {
        results.push({
          accessKey: row.accessKey,
          emitterRuc: row.emitterRuc,
          emitterName: row.emitterName,
          documentType: row.documentType,
          status: importResult.error.includes("ya está registrado")
            ? "already_exists"
            : "import_failed",
          error: importResult.error,
        });
        if (importResult.error.includes("ya está registrado")) skipped++;
        else failed++;
      }
    } catch {
      results.push({
        accessKey: row.accessKey,
        emitterRuc: row.emitterRuc,
        emitterName: row.emitterName,
        documentType: row.documentType,
        status: "import_failed",
        error: "Error interno al importar documento.",
      });
      failed++;
    }

    if (DELAY_BETWEEN_SOAP_MS > 0) await sleep(DELAY_BETWEEN_SOAP_MS);
  }

  return NextResponse.json({
    ok: true,
    summary: {
      total: rows.length,
      imported,
      skipped,
      failed,
    },
    results,
  });
}
