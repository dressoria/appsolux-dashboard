import { NextResponse } from "next/server";
import { createErpnextStockEntry } from "@/lib/api/erpnext/stock-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreateStockEntryInput } from "@/types/erpnext";

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
    const warehouse = getStringField(body, "warehouse");
    const qty = getNumberField(body, "qty");
    const basicRate = getNumberField(body, "basic_rate");

    if (!itemCode || !warehouse || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STOCK_ENTRY_INPUT",
            message: "item_code, warehouse and qty greater than 0 are required",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateStockEntryInput = {
      item_code: itemCode,
      warehouse,
      qty,
      basic_rate: Number.isFinite(basicRate) ? basicRate : undefined,
    };
    const stockEntry = await createErpnextStockEntry(input);

    return NextResponse.json({
      success: true,
      data: { stock_entry: stockEntry },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext stock entry error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_STOCK_ENTRY_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
