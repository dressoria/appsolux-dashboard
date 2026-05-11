import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import { createErpnextStockAdjustment } from "@/lib/api/erpnext/stock-adjustments";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { CreateStockAdjustmentInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }

  return Number.NaN;
}

export async function POST(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);

    if (!tenantMode.erpProvisioning.isRealActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ERP_NOT_ACTIVE",
            message: "ERP dedicado no esta activo.",
          },
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const itemCode = getStringField(body, "item_code");
    const warehouse = getStringField(body, "warehouse");
    const countedQty = getNumberField(body, "counted_qty");
    const reason = getStringField(body, "reason");
    const note = getStringField(body, "note");

    if (
      !itemCode ||
      !warehouse ||
      !Number.isFinite(countedQty) ||
      countedQty < 0 ||
      !reason
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STOCK_ADJUSTMENT_INPUT",
            message:
              "Producto, bodega, stock contado mayor o igual a 0 y motivo son requeridos",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateStockAdjustmentInput = {
      item_code: itemCode,
      warehouse,
      counted_qty: countedQty,
      reason,
      note: note || undefined,
    };
    const adjustment = await createErpnextStockAdjustment(input);

    return NextResponse.json({
      success: true,
      data: adjustment,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo ajustar el inventario";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_STOCK_ADJUSTMENT_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
