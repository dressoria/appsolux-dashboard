import { NextResponse } from "next/server";
import {
  deleteErpnextSupplier,
  disableErpnextSupplier,
  updateErpnextSupplier,
} from "@/lib/api/erpnext/suppliers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { UpdateErpnextSupplierInput } from "@/types/erpnext";

type RouteContext = {
  params: Promise<{ supplierName: string }>;
};

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

async function requireActiveErp() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "User session is required" },
        },
        { status: 401 }
      ),
    };
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "ERP_NOT_ACTIVE",
            message: "El ERP dedicado debe estar activo para proveedores.",
          },
        },
        { status: 403 }
      ),
    };
  }

  return { error: null };
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const { supplierName } = await context.params;
    const decodedName = decodeURIComponent(supplierName);
    const body = (await request.json()) as Record<string, unknown>;
    const supplierNameField = getStringField(body, "supplier_name");

    if (!decodedName.trim() || !supplierNameField) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SUPPLIER_UPDATE_INPUT",
            message: "Nombre de proveedor requerido.",
          },
        },
        { status: 400 }
      );
    }

    const input: UpdateErpnextSupplierInput = {
      supplier_name: supplierNameField,
      supplier_type: getStringField(body, "supplier_type") || "Company",
      tax_id: getStringField(body, "tax_id") || undefined,
      mobile_no: getStringField(body, "mobile_no") || undefined,
      email_id: getStringField(body, "email_id") || undefined,
    };
    const supplier = await updateErpnextSupplier(decodedName, input);

    return NextResponse.json({ success: true, data: { supplier } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo actualizar el proveedor.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_UPDATE_SUPPLIER_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const { supplierName } = await context.params;
    const decodedName = decodeURIComponent(supplierName);

    if (!decodedName.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SUPPLIER_DELETE_INPUT",
            message: "Nombre de proveedor requerido.",
          },
        },
        { status: 400 }
      );
    }

    try {
      await deleteErpnextSupplier(decodedName);

      return NextResponse.json({
        success: true,
        data: { action: "deleted", name: decodedName },
      });
    } catch {
      const supplier = await disableErpnextSupplier(decodedName);

      return NextResponse.json({
        success: true,
        data: { action: "disabled", supplier },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo desactivar el proveedor.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_DELETE_SUPPLIER_ERROR", message },
      },
      { status: 500 }
    );
  }
}
