import { NextResponse } from "next/server";
import {
  createErpnextStockTransfer,
  getErpnextStockTransfers,
} from "@/lib/api/erpnext/stock-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreateStockTransferInput } from "@/types/erpnext";

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
    const transfers = await getErpnextStockTransfers();
    return NextResponse.json({ success: true, data: { transfers } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al obtener transferencias";
    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_TRANSFERS_ERROR", message } },
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
    const from_warehouse = getStringField(body, "from_warehouse");
    const to_warehouse = getStringField(body, "to_warehouse");
    const posting_date = getStringField(body, "posting_date");

    if (!from_warehouse) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Selecciona bodega origen." } },
        { status: 400 }
      );
    }
    if (!to_warehouse) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Selecciona bodega destino." } },
        { status: 400 }
      );
    }
    if (from_warehouse === to_warehouse) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Bodega origen y destino no pueden ser la misma." } },
        { status: 400 }
      );
    }
    if (!posting_date) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "La fecha es requerida." } },
        { status: 400 }
      );
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .filter(
        (r): r is { item_code: string; qty: number } =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as Record<string, unknown>).item_code === "string" &&
          (r as Record<string, unknown>).item_code !== "" &&
          Number((r as Record<string, unknown>).qty) > 0
      )
      .map((r) => ({ item_code: r.item_code, qty: Number(r.qty) }));

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Agrega al menos un producto con cantidad mayor a 0." } },
        { status: 400 }
      );
    }

    const input: CreateStockTransferInput = { posting_date, from_warehouse, to_warehouse, items };
    const transfer = await createErpnextStockTransfer(input);

    return NextResponse.json({ success: true, data: { transfer } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la transferencia.";
    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_TRANSFER_CREATE_ERROR", message } },
      { status: 500 }
    );
  }
}
