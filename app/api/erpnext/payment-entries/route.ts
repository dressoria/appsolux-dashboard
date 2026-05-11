import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  createAndSubmitErpnextPaymentEntry,
  getErpnextPaymentEntries,
} from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { CreatePaymentEntryInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }

  return Number.NaN;
}

export async function GET() {
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
    const paymentEntries = await getErpnextPaymentEntries();

    return NextResponse.json({
      success: true,
      data: { payment_entries: paymentEntries },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron cargar los pagos";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_PAYMENT_ENTRIES_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
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
    const salesInvoiceName = getStringField(body, "sales_invoice_name");
    const paidAmount = getNumberField(body, "paid_amount");
    const modeOfPayment = getStringField(body, "mode_of_payment");
    const referenceNo = getStringField(body, "reference_no");
    const referenceDate = getStringField(body, "reference_date");
    const note = getStringField(body, "note");

    if (!salesInvoiceName || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PAYMENT_INPUT",
            message: "Factura y monto mayor a 0 son requeridos",
          },
        },
        { status: 400 }
      );
    }

    if (!modeOfPayment) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PAYMENT_MODE",
            message: "Selecciona un metodo de pago",
          },
        },
        { status: 400 }
      );
    }

    const input: CreatePaymentEntryInput = {
      sales_invoice_name: salesInvoiceName,
      paid_amount: paidAmount,
      mode_of_payment: modeOfPayment,
      reference_no: referenceNo || undefined,
      reference_date: referenceDate || undefined,
      note: note || undefined,
    };
    const paymentEntry = await createAndSubmitErpnextPaymentEntry(input);

    return NextResponse.json({
      success: true,
      data: {
        payment_entry: {
          name: paymentEntry.name,
          paid_amount: paymentEntry.paid_amount,
          mode_of_payment: paymentEntry.mode_of_payment,
          party: paymentEntry.party,
          docstatus: paymentEntry.docstatus,
          status: paymentEntry.status,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo registrar el pago";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_CREATE_PAYMENT_ENTRY_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
