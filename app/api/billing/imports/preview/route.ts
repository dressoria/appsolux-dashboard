import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { buildBillingImportPreview } from "@/lib/core/business-suite/billing-imports";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Sesion requerida." } }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);
    if (!tenantMode.canUseAdvancedErp) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BILLING_IMPORTS_ERP_REQUIRED",
            message: "Las cargas masivas están disponibles en Gestión Empresarial.",
          },
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const type = getStringField(body, "type") === "customers" ? "customers" : "products";
    const csvText = getStringField(body, "csvText");
    if (!csvText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "EMPTY_IMPORT_FILE", message: "Debes subir un archivo CSV con datos." },
        },
        { status: 400 }
      );
    }

    const preview = await buildBillingImportPreview(tenant.id, type, csvText);
    return NextResponse.json({ success: true, data: { preview } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BILLING_IMPORT_PREVIEW_ERROR",
          message: error instanceof Error ? error.message : "No se pudo generar la previsualización.",
        },
      },
      { status: 500 }
    );
  }
}
