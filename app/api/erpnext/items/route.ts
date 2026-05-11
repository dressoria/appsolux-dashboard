import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  createErpnextItem,
  deleteErpnextItem,
  disableErpnextItem,
  getErpnextItems,
  updateErpnextItem,
} from "@/lib/api/erpnext/items";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreateErpnextItemInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function PUT(request: Request) {
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
    const itemName = getStringField(body, "item_name");
    const stockUom = getStringField(body, "stock_uom");
    const itemGroup = getStringField(body, "item_group");

    if (!name || !itemName || !stockUom || !itemGroup) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ITEM_UPDATE_INPUT",
            message: "name, item_name, item_group and stock_uom are required",
          },
        },
        { status: 400 }
      );
    }

    const item = await updateErpnextItem(name, {
      item_name: itemName,
      stock_uom: stockUom,
      item_group: itemGroup,
      is_stock_item: getBooleanField(body, "is_stock_item"),
    });

    return NextResponse.json({
      success: true,
      data: { item },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERP item update";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_UPDATE_ITEM_ERROR",
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
            code: "INVALID_ITEM_DELETE_INPUT",
            message: "item name is required",
          },
        },
        { status: 400 }
      );
    }

    try {
      await deleteErpnextItem(name);

      return NextResponse.json({
        success: true,
        data: { action: "deleted", name },
      });
    } catch {
      const item = await disableErpnextItem(name);

      return NextResponse.json({
        success: true,
        data: { action: "disabled", item },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERP item delete";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_DELETE_ITEM_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

function getBooleanField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "boolean" ? value : undefined;
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

    const items = await getErpnextItems();

    return NextResponse.json({
      success: true,
      data: { items },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERPNext items error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_ITEMS_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
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

    const body = (await request.json()) as Record<string, unknown>;
    const itemCode = getStringField(body, "item_code");
    const itemName = getStringField(body, "item_name");
    const stockUom = getStringField(body, "stock_uom");
    const itemGroup = getStringField(body, "item_group");

    if (!itemCode || !itemName || !stockUom || !itemGroup) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ITEM_INPUT",
            message:
              "item_code, item_name, item_group and stock_uom are required",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateErpnextItemInput = {
      item_code: itemCode,
      item_name: itemName,
      stock_uom: stockUom,
      item_group: itemGroup,
      is_stock_item: getBooleanField(body, "is_stock_item"),
    };
    const item = await createErpnextItem(input);

    return NextResponse.json({
      success: true,
      data: { item },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERPNext item error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_ITEM_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
