import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  getErpnextSalesInvoiceDetail,
  submitErpnextSalesInvoice,
} from "@/lib/api/erpnext/sales-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesInvoiceRouteContext = {
  params: Promise<{
    salesInvoiceName: string;
  }>;
};

export async function POST(_request: Request, context: SalesInvoiceRouteContext) {
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

    const { salesInvoiceName } = await context.params;
    const decodedName = decodeURIComponent(salesInvoiceName).trim();

    if (!decodedName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SALES_INVOICE_NAME",
            message: "El numero de factura es requerido",
          },
        },
        { status: 400 }
      );
    }

    const salesInvoice = await getErpnextSalesInvoiceDetail(decodedName);

    if (salesInvoice.docstatus !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SALES_INVOICE_NOT_DRAFT",
            message: "Solo se pueden confirmar facturas en borrador.",
          },
        },
        { status: 400 }
      );
    }

    const submittedSalesInvoice = await submitErpnextSalesInvoice(salesInvoice);

    return NextResponse.json({
      success: true,
      data: {
        sales_invoice: {
          name: submittedSalesInvoice.name,
          status: submittedSalesInvoice.status,
          docstatus: submittedSalesInvoice.docstatus,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo confirmar la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_SUBMIT_SALES_INVOICE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
