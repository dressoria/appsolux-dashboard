import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  createCorrectedSalesInvoiceFromCancelled,
  getErpnextSalesInvoiceDetail,
} from "@/lib/api/erpnext/sales-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesInvoiceRouteContext = {
  params: Promise<{
    salesInvoiceName: string;
  }>;
};

function isCancelledInvoice(status?: string, docstatus?: 0 | 1 | 2) {
  return docstatus === 2 || status?.toLowerCase() === "cancelled";
}

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

    const originalInvoice = await getErpnextSalesInvoiceDetail(decodedName);

    if (!isCancelledInvoice(originalInvoice.status, originalInvoice.docstatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SALES_INVOICE_NOT_CANCELLED",
            message: "Solo se puede crear correccion desde una factura anulada.",
          },
        },
        { status: 400 }
      );
    }

    const correctedInvoice = await createCorrectedSalesInvoiceFromCancelled(
      decodedName
    );

    return NextResponse.json({
      success: true,
      data: {
        corrected_invoice: {
          name: correctedInvoice.name,
          customer: correctedInvoice.customer,
          grand_total: correctedInvoice.grand_total,
          docstatus: correctedInvoice.docstatus,
          status: correctedInvoice.status,
        },
        original_invoice: decodedName,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo crear la correccion de la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CORRECT_SALES_INVOICE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
