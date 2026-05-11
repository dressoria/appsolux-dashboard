import { NextResponse } from "next/server";
import {
  requireActiveErpTenantForApi,
  resolveTenantErpCompany,
} from "@/lib/core/require-active-erp-tenant";
import {
  createErpnextPurchaseInvoice,
  getErpnextPurchaseInvoices,
} from "@/lib/api/erpnext/purchase-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CreatePurchaseInvoiceInput, CreatePurchaseInvoiceItemInput } from "@/types/erpnext";

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

    const invoices = await getErpnextPurchaseInvoices();

    return NextResponse.json({ success: true, data: { invoices } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ERPNext purchase invoices error";

    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_PURCHASE_INVOICES_ERROR", message } },
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
    const items: CreatePurchaseInvoiceItemInput[] = rawItems
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

    const input: CreatePurchaseInvoiceInput = {
      supplier,
      company,
      posting_date,
      bill_no: getStringField(body, "bill_no") || undefined,
      items,
    };

    const invoice = await createErpnextPurchaseInvoice(input);

    return NextResponse.json({ success: true, data: { invoice } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected ERPNext purchase invoice error";

    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_CREATE_INVOICE_ERROR", message } },
      { status: 500 }
    );
  }
}
