import { NextResponse } from "next/server";
import {
  requireActiveErpTenantForApi,
  resolveTenantErpCompany,
} from "@/lib/core/require-active-erp-tenant";
import {
  createErpnextPurchaseOrder,
  getErpnextPurchaseOrders,
} from "@/lib/api/erpnext/purchase-orders";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreatePurchaseOrderInput, CreatePurchaseOrderItemInput } from "@/types/erpnext";

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
        { success: false, error: { code: "UNAUTHORIZED", message: "User session is required" } },
        { status: 401 }
      );
    }

    const orders = await getErpnextPurchaseOrders();

    return NextResponse.json({ success: true, data: { orders } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ERPNext purchase orders error";

    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_PURCHASE_ORDERS_ERROR", message } },
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
        { success: false, error: { code: "UNAUTHORIZED", message: "User session is required" } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const supplier = getStringField(body, "supplier");
    const companyResult = await resolveTenantErpCompany(
      erpGuard,
      getStringField(body, "company")
    );
    if (!companyResult.ok) return companyResult.response;
    const company = companyResult.company;
    const transaction_date = getStringField(body, "transaction_date");

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
    if (!transaction_date) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "transaction_date es requerido" } },
        { status: 400 }
      );
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: CreatePurchaseOrderItemInput[] = rawItems
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
      .map((item) => ({
        item_code: typeof item.item_code === "string" ? item.item_code : "",
        qty: typeof item.qty === "number" ? item.qty : Number(item.qty) || 0,
        rate: typeof item.rate === "number" ? item.rate : Number(item.rate) || 0,
        ...(typeof item.warehouse === "string" && item.warehouse
          ? { warehouse: item.warehouse }
          : {}),
      }))
      .filter((item) => item.item_code && item.qty > 0);

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Se requiere al menos un producto con cantidad mayor a cero" } },
        { status: 400 }
      );
    }

    const input: CreatePurchaseOrderInput = {
      supplier,
      company,
      transaction_date,
      items,
    };

    const order = await createErpnextPurchaseOrder(input);

    return NextResponse.json({ success: true, data: { order } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ERPNext purchase order error";

    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_CREATE_ORDER_ERROR", message } },
      { status: 500 }
    );
  }
}
