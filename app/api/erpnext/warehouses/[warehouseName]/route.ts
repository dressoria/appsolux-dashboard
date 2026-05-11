import { NextResponse } from "next/server";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextStockLedger } from "@/lib/api/erpnext/stock-ledger";
import {
  deleteErpnextWarehouse,
  getErpnextWarehouseDetail,
  updateErpnextWarehouse,
} from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type WarehouseRouteContext = {
  params: Promise<{
    warehouseName: string;
  }>;
};

async function getAuthorizedWarehouseName(context: WarehouseRouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
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
            message: "El ERP dedicado debe estar activo para bodegas.",
          },
        },
        { status: 403 }
      ),
    };
  }

  const { warehouseName } = await context.params;
  const decodedName = decodeURIComponent(warehouseName).trim();

  if (!decodedName) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_WAREHOUSE_NAME",
            message: "El nombre de la bodega es requerido",
          },
        },
        { status: 400 }
      ),
    };
  }

  return { name: decodedName };
}

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : undefined;
}

function getBooleanField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "boolean" ? value : undefined;
}

export async function PATCH(request: Request, context: WarehouseRouteContext) {
  try {
    const resolved = await getAuthorizedWarehouseName(context);

    if (resolved.error) {
      return resolved.error;
    }

    await getErpnextWarehouseDetail(resolved.name);

    const body = (await request.json()) as Record<string, unknown>;
    const warehouse = await updateErpnextWarehouse(resolved.name, {
      warehouse_name: getStringField(body, "warehouse_name"),
      disabled: getBooleanField(body, "disabled"),
    });

    return NextResponse.json({
      success: true,
      data: { warehouse },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar bodega";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_WAREHOUSE_UPDATE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: WarehouseRouteContext
) {
  try {
    const resolved = await getAuthorizedWarehouseName(context);

    if (resolved.error) {
      return resolved.error;
    }

    await getErpnextWarehouseDetail(resolved.name);

    const [inventory, movements] = await Promise.all([
      getErpnextInventory(),
      getErpnextStockLedger({ warehouse: resolved.name }),
    ]);
    const hasStock = inventory.some(
      (bin) =>
        bin.warehouse === resolved.name &&
        typeof bin.actual_qty === "number" &&
        bin.actual_qty !== 0
    );

    if (hasStock || movements.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WAREHOUSE_HAS_MOVEMENTS",
            message:
              "Esta bodega ya tiene movimientos o stock. No se puede eliminar; puedes desactivarla.",
          },
        },
        { status: 400 }
      );
    }

    await deleteErpnextWarehouse(resolved.name);

    return NextResponse.json({
      success: true,
      data: { action: "deleted", name: resolved.name },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar bodega";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_WAREHOUSE_DELETE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
