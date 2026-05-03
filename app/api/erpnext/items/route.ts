import { NextResponse } from "next/server";
import {
  createErpnextItem,
  getErpnextItems,
} from "@/lib/api/erpnext/items";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreateErpnextItemInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getBooleanField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "boolean" ? value : undefined;
}

export async function GET() {
  try {
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
