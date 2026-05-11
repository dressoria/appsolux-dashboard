import { type NextRequest, NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  getErpnextPrintPdf,
  isAllowedPrintFormat,
  isAllowedDoctype,
} from "@/lib/api/erpnext/print";

function sanitizeFilename(doctype: string, name: string): string {
  const safe = (s: string) =>
    s
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  return `${safe(doctype)}-${safe(name)}.pdf`;
}

export async function GET(request: NextRequest) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);

    if (!tenantMode.erpProvisioning.isRealActive) {
      return NextResponse.json(
        { error: "ERP no activo para este tenant" },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const doctype = searchParams.get("doctype") ?? "";
    const name = searchParams.get("name") ?? "";
    const action = searchParams.get("action") ?? "view";
    const printFormat = searchParams.get("print_format") ?? "Standard";

    if (!isAllowedDoctype(doctype)) {
      return NextResponse.json(
        { error: "Tipo de documento no permitido" },
        { status: 400 }
      );
    }

    if (!name.trim()) {
      return NextResponse.json(
        { error: "Nombre de documento requerido" },
        { status: 400 }
      );
    }

    if (action !== "view" && action !== "download") {
      return NextResponse.json(
        { error: "Accion de documento no permitida" },
        { status: 400 }
      );
    }

    if (!isAllowedPrintFormat(printFormat)) {
      return NextResponse.json(
        { error: "Formato de impresion no permitido" },
        { status: 400 }
      );
    }

    const pdfResponse = await getErpnextPrintPdf(doctype, name, {
      format: printFormat,
    });

    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "El ERP no pudo generar el PDF" },
        { status: pdfResponse.status }
      );
    }

    const filename = sanitizeFilename(doctype, name);
    const disposition =
      action === "download"
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`;

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener el PDF del ERP" },
      { status: 502 }
    );
  }
}
