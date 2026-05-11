import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  deleteErpnextInventoryBin,
  getErpnextInventory,
} from "@/lib/api/erpnext/inventory";
import { getCurrentUser } from "@/lib/auth/current-user";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
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

    const inventory = await getErpnextInventory();

    return NextResponse.json({
      success: true,
      data: { inventory },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext inventory error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_INVENTORY_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

    const body = (await request.json()) as Record<string, unknown>;
    const name = getStringField(body, "name");

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INVENTORY_DELETE_INPUT",
            message: "inventory row name is required",
          },
        },
        { status: 400 }
      );
    }

    await deleteErpnextInventoryBin(name);

    return NextResponse.json({
      success: true,
      data: {
        action: "deleted",
        name,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar este registro de inventario";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_DELETE_INVENTORY_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
