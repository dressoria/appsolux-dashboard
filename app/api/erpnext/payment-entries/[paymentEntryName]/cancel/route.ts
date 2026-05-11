import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  cancelErpnextPaymentEntry,
  getErpnextPaymentEntryDetail,
} from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type PaymentEntryRouteContext = {
  params: Promise<{
    paymentEntryName: string;
  }>;
};

function getFriendlyCancelError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("reconcile") ||
    lowerMessage.includes("concili") ||
    lowerMessage.includes("linked")
  ) {
    return "No se puede anular el pago porque esta conciliado o tiene documentos relacionados.";
  }

  return message;
}

export async function POST(_request: Request, context: PaymentEntryRouteContext) {
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

    if (paymentEntry.docstatus !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PAYMENT_ENTRY_NOT_SUBMITTED",
            message: "Solo se pueden anular pagos confirmados.",
          },
        },
        { status: 400 }
      );
    }

    const cancelledPaymentEntry = await cancelErpnextPaymentEntry(decodedName);

    return NextResponse.json({
      success: true,
      data: {
        payment_entry: {
          name: cancelledPaymentEntry.name,
          status: cancelledPaymentEntry.status,
          docstatus: cancelledPaymentEntry.docstatus,
          paid_amount: cancelledPaymentEntry.paid_amount,
          mode_of_payment: cancelledPaymentEntry.mode_of_payment,
        },
      },
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "No se pudo anular el pago";
    const message = getFriendlyCancelError(rawMessage);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CANCEL_PAYMENT_ENTRY_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
