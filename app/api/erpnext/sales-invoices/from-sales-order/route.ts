import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import { createSalesInvoiceFromSalesOrder } from "@/lib/api/erpnext/sales-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { CreateSalesInvoiceFromOrderInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
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

    await getCurrentTenant(user);

    const body = (await request.json()) as Record<string, unknown>;
    const salesOrderName = getStringField(body, "sales_order_name");

    if (!salesOrderName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SALES_ORDER_NAME",
            message: "El numero de pedido es requerido",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateSalesInvoiceFromOrderInput = {
      sales_order_name: salesOrderName,
    };
    const salesInvoice = await createSalesInvoiceFromSalesOrder(input);

    return NextResponse.json({
      success: true,
      data: {
        sales_invoice: {
          name: salesInvoice.name,
          customer: salesInvoice.customer,
          grand_total: salesInvoice.grand_total,
          status: salesInvoice.status,
          docstatus: salesInvoice.docstatus,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo preparar la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_SALES_INVOICE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
