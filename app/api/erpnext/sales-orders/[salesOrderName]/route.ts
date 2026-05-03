import { NextResponse } from "next/server";
import { getErpnextSalesOrderDetail } from "@/lib/api/erpnext/sales-orders";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesOrderRouteContext = {
  params: Promise<{
    salesOrderName: string;
  }>;
};

export async function GET(_request: Request, context: SalesOrderRouteContext) {
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

    const { salesOrderName } = await context.params;
    const decodedName = decodeURIComponent(salesOrderName).trim();

    if (!decodedName) {
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

    const salesOrder = await getErpnextSalesOrderDetail(decodedName);

    return NextResponse.json({
      success: true,
      data: { sales_order: salesOrder },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el detalle del pedido";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_SALES_ORDER_DETAIL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
