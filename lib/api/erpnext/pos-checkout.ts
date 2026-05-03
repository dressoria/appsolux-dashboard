import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import {
  getErpnextSalesInvoiceDetail,
  submitErpnextSalesInvoice,
} from "./sales-invoices";
import { createAndSubmitErpnextPaymentEntry } from "./payment-entries";
import type {
  ErpnextCreateResponse,
  ErpnextSalesInvoice,
  PosCheckoutInput,
  PosCheckoutResult,
} from "@/types/erpnext";

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function createPosSalesInvoice(
  input: PosCheckoutInput
): Promise<ErpnextSalesInvoice> {
  const today = getTodayDate();
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesInvoice>>(
    "/api/resource/Sales%20Invoice",
    {
      method: "POST",
      body: JSON.stringify({
        customer: input.customer,
        company: input.company,
        posting_date: today,
        due_date: today,
        update_stock: 1,
        set_warehouse: input.warehouse,
        remarks: input.note,
        items: input.items.map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          warehouse: item.warehouse ?? input.warehouse,
        })),
      }),
    }
  );

  return response.data;
}

export async function createErpnextPosCheckout(
  input: PosCheckoutInput
): Promise<PosCheckoutResult> {
  const invoice = await createPosSalesInvoice(input);
  const fullInvoice = await getErpnextSalesInvoiceDetail(invoice.name);
  let submittedInvoice: ErpnextSalesInvoice;

  try {
    submittedInvoice = await submitErpnextSalesInvoice(fullInvoice);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo confirmar la factura por configuracion del ERP.";

    throw new Error(
      `La factura fue preparada (${invoice.name}), pero no pudo confirmarse por configuracion del ERP. ${message}`
    );
  }

  try {
    const payment = await createAndSubmitErpnextPaymentEntry({
      sales_invoice_name: submittedInvoice.name,
      paid_amount: input.paid_amount,
      mode_of_payment: input.mode_of_payment,
      reference_no: input.reference_no,
      reference_date: input.reference_date,
      note: input.note,
    });

    return {
      invoice: {
        name: submittedInvoice.name,
        customer: submittedInvoice.customer,
        grand_total: submittedInvoice.grand_total,
        status: submittedInvoice.status,
        docstatus: submittedInvoice.docstatus,
      },
      payment: {
        name: payment.name,
        paid_amount: payment.paid_amount,
        mode_of_payment: payment.mode_of_payment,
        party: payment.party,
        status: payment.status,
        docstatus: payment.docstatus,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo confirmar el pago por configuracion del ERP.";

    throw new Error(
      `La venta fue registrada con la factura ${submittedInvoice.name}, pero el pago no pudo confirmarse. ${message}`
    );
  }
}
