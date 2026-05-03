import { NextResponse } from "next/server";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
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
    const modesOfPayment = await getErpnextModesOfPayment();

    return NextResponse.json({
      success: true,
      data: { modes_of_payment: modesOfPayment },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar los metodos de pago";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_MODES_OF_PAYMENT_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
