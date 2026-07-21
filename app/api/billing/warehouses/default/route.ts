import { NextResponse } from "next/server";

import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import {
  getTenantPreferredWarehouseName,
  setTenantPreferredWarehouseName,
} from "@/lib/core/business-suite/erpnext-master-data";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
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
            code: "BILLING_WAREHOUSE_ERP_REQUIRED",
            message: "La bodega principal solo aplica en Gestión Empresarial.",
          },
        },
        { status: 409 }
      );
    }

    const preferredWarehouseName = await getTenantPreferredWarehouseName(tenant.id);
    return NextResponse.json({ success: true, data: { preferredWarehouseName } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BILLING_DEFAULT_WAREHOUSE_ERROR",
          message: error instanceof Error ? error.message : "No se pudo cargar la bodega principal.",
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
            code: "BILLING_WAREHOUSE_ERP_REQUIRED",
            message: "La bodega principal solo aplica en Gestión Empresarial.",
          },
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const warehouseName = getStringField(body, "warehouseName");
    if (!warehouseName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_WAREHOUSE_NAME",
            message: "Selecciona una bodega válida.",
          },
        },
        { status: 400 }
      );
    }

    const warehouses = await getErpnextWarehouses();
    const matched = warehouses.find(
      (warehouse) =>
        warehouse.is_group !== 1 &&
        warehouse.disabled !== 1 &&
        warehouse.name === warehouseName
    );

    if (!matched) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_WAREHOUSE_NAME",
            message: "La bodega seleccionada no está disponible para este tenant.",
          },
        },
        { status: 400 }
      );
    }

    await setTenantPreferredWarehouseName(tenant.id, warehouseName);
    return NextResponse.json({ success: true, data: { warehouseName } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BILLING_DEFAULT_WAREHOUSE_UPDATE_ERROR",
          message: error instanceof Error ? error.message : "No se pudo guardar la bodega principal.",
        },
      },
      { status: 500 }
    );
  }
}
