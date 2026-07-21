import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { confirmBillingImport } from "@/lib/core/business-suite/billing-imports";
import { getPrismaClient } from "@/lib/db/prisma";
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
    const updateExisting = body.updateExisting !== false;

    if (!csvText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "EMPTY_IMPORT_FILE", message: "Debes subir un archivo CSV con datos." },
        },
        { status: 400 }
      );
    }

    const result = await confirmBillingImport(tenant.id, type, csvText, { updateExisting });

    await getPrismaClient().auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        action: "billing.import.confirm",
        entityType: "BillingImport",
        entityId: `${type}:${Date.now()}`,
        metadata: {
          type,
          totalRows: result.preview.summary.totalRows,
          created: result.created,
          updated: result.updated,
          failed: result.failed,
          skipped: result.skipped,
          errors: result.errors.slice(0, 20),
        },
      },
    });

    return NextResponse.json({ success: true, data: { result } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BILLING_IMPORT_CONFIRM_ERROR",
          message: error instanceof Error ? error.message : "No se pudo confirmar la importación.",
        },
      },
      { status: 500 }
    );
  }
}
