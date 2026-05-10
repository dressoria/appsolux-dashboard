import { NextResponse } from "next/server";
import { createErpnextSupplierPaymentEntry } from "@/lib/api/erpnext/payment-entries";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { CreateSupplierPaymentEntryInput } from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User session is required" } },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const tenantMode = await getTenantModeState(tenant);

    if (!tenantMode.erpProvisioning.isRealActive) {
      return NextResponse.json(
        { success: false, error: { code: "ERP_NOT_ACTIVE", message: "ERP dedicado no esta activo." } },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const purchaseInvoiceName = getStringField(body, "purchase_invoice_name");
    const paidAmount = getNumberField(body, "paid_amount");
    const modeOfPayment = getStringField(body, "mode_of_payment");
    const referenceNo = getStringField(body, "reference_no");
    const referenceDate = getStringField(body, "reference_date");
    const note = getStringField(body, "note");

    if (!purchaseInvoiceName) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_INVOICE", message: "Factura de compra requerida." } },
        { status: 400 }
      );
    }

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_AMOUNT", message: "El monto debe ser mayor a 0." } },
        { status: 400 }
      );
    }

    if (!modeOfPayment) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_MODE", message: "Selecciona un metodo de pago." } },
        { status: 400 }
      );
    }

    const input: CreateSupplierPaymentEntryInput = {
      purchase_invoice_name: purchaseInvoiceName,
      paid_amount: paidAmount,
      mode_of_payment: modeOfPayment,
      reference_no: referenceNo || undefined,
      reference_date: referenceDate || undefined,
      note: note || undefined,
    };

    const paymentEntry = await createErpnextSupplierPaymentEntry(input);

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
      error instanceof Error ? error.message : "No se pudo registrar el pago al proveedor.";

    return NextResponse.json(
      { success: false, error: { code: "ERPNEXT_SUPPLIER_PAYMENT_ERROR", message } },
      { status: 500 }
    );
  }
}
