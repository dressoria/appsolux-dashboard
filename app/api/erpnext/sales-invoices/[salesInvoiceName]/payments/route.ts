import { NextResponse } from "next/server";
import { getPaymentEntriesForSalesInvoice } from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesInvoicePaymentsRouteContext = {
  params: Promise<{
    salesInvoiceName: string;
  }>;
};

export async function GET(
  _request: Request,
  context: SalesInvoicePaymentsRouteContext
) {
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

    const payments = await getPaymentEntriesForSalesInvoice(decodedName);

    return NextResponse.json({
      success: true,
      data: { payments },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar los pagos asociados";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_SALES_INVOICE_PAYMENTS_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
