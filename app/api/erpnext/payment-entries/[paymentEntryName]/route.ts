import { NextResponse } from "next/server";
import { getErpnextPaymentEntryDetail } from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type PaymentEntryRouteContext = {
  params: Promise<{
    paymentEntryName: string;
  }>;
};

export async function GET(_request: Request, context: PaymentEntryRouteContext) {
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

    const { paymentEntryName } = await context.params;
    const decodedName = decodeURIComponent(paymentEntryName).trim();

    if (!decodedName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PAYMENT_ENTRY_NAME",
            message: "El numero de pago es requerido",
          },
        },
        { status: 400 }
      );
    }

    const paymentEntry = await getErpnextPaymentEntryDetail(decodedName);

    return NextResponse.json({
      success: true,
      data: { payment_entry: paymentEntry },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el detalle del pago";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_PAYMENT_ENTRY_DETAIL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
