import { NextResponse } from "next/server";
import { getErpnextSalesInvoiceDetail } from "@/lib/api/erpnext/sales-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesInvoiceRouteContext = {
  params: Promise<{
    salesInvoiceName: string;
  }>;
};

export async function GET(_request: Request, context: SalesInvoiceRouteContext) {
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

    return NextResponse.json({
      success: true,
      data: { sales_invoice: salesInvoice },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el detalle de la factura";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_SALES_INVOICE_DETAIL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
