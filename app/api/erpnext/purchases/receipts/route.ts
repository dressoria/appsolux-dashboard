import { NextResponse } from "next/server";
import {
  createErpnextPurchaseReceipt,
  getErpnextPurchaseReceipts,
} from "@/lib/api/erpnext/purchase-receipts";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreatePurchaseReceiptInput, CreatePurchaseReceiptItemInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User session is required" } },
        { status: 401 }
      );
    }

    const receipts = await getErpnextPurchaseReceipts();

    return NextResponse.json({ success: true, data: { receipts } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ERPNext purchase receipts error";

    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_PURCHASE_RECEIPTS_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User session is required" } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const supplier = getStringField(body, "supplier");
    const company = getStringField(body, "company");
    const posting_date = getStringField(body, "posting_date");

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "supplier es requerido" } },
        { status: 400 }
      );
    }
    if (!company) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "company es requerido" } },
        { status: 400 }
      );
    }
    if (!posting_date) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "posting_date es requerido" } },
        { status: 400 }
      );
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: CreatePurchaseReceiptItemInput[] = rawItems
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
      .map((item) => ({
        item_code: typeof item.item_code === "string" ? item.item_code : "",
        qty: typeof item.qty === "number" ? item.qty : Number(item.qty) || 0,
        warehouse: typeof item.warehouse === "string" ? item.warehouse : "",
        ...(item.rate !== undefined && item.rate !== ""
          ? { rate: typeof item.rate === "number" ? item.rate : Number(item.rate) }
          : {}),
      }))
      .filter((item) => item.item_code && item.qty > 0 && item.warehouse);

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Se requiere al menos un producto con cantidad y bodega" } },
        { status: 400 }
      );
    }

    const input: CreatePurchaseReceiptInput = {
      supplier,
      company,
      posting_date,
      items,
    };

    const receipt = await createErpnextPurchaseReceipt(input);

    return NextResponse.json({ success: true, data: { receipt } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ERPNext purchase receipt error";

    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_CREATE_RECEIPT_ERROR", message } },
      { status: 500 }
    );
  }
}
