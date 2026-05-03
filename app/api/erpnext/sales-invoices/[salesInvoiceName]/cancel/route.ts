import { NextResponse } from "next/server";
import {
  cancelErpnextSalesInvoice,
  getErpnextSalesInvoiceDetail,
} from "@/lib/api/erpnext/sales-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesInvoiceRouteContext = {
  params: Promise<{
    salesInvoiceName: string;
  }>;
};

function getFriendlyCancelError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("payment") ||
    lowerMessage.includes("pago") ||
    lowerMessage.includes("linked") ||
    lowerMessage.includes("against")
  ) {
    return "No se pudo anular la factura. Puede que tenga pagos asociados; primero anula o revisa el pago relacionado.";
  }

  return message;
}

export async function POST(request: Request, context: SalesInvoiceRouteContext) {
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

    if (salesInvoice.docstatus !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SALES_INVOICE_NOT_SUBMITTED",
            message: "Solo se pueden anular facturas confirmadas.",
          },
        },
        { status: 400 }
      );
    }

    const cancelledSalesInvoice = await cancelErpnextSalesInvoice(decodedName);

    return NextResponse.json({
      success: true,
      data: {
        sales_invoice: {
          name: cancelledSalesInvoice.name,
          status: cancelledSalesInvoice.status,
          docstatus: cancelledSalesInvoice.docstatus,
        },
      },
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error
        ? error.message
        : "No se pudo anular la factura";
    const message = getFriendlyCancelError(rawMessage);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CANCEL_SALES_INVOICE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
