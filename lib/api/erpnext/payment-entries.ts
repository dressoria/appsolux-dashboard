import "@/lib/security/server-only";
import { getErpnextAccountCurrency } from "./accounts";
import { erpnextFetch } from "./client";
import { getErpnextPaymentAccountForMode } from "./modes-of-payment";
import { getErpnextSalesInvoiceDetail } from "./sales-invoices";
import type {
  CreatePaymentEntryInput,
  ErpnextCreateResponse,
  ErpnextMethodResponse,
  ErpnextPaymentEntry,
} from "@/types/erpnext";

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getPaymentEntryPath(name: string) {
  return `/api/resource/Payment%20Entry/${encodeURIComponent(name)}`;
}

export async function getErpnextPaymentEntry(
  name: string
): Promise<ErpnextPaymentEntry> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPaymentEntry>>(
    getPaymentEntryPath(name)
  );

  return response.data;
}

export async function submitErpnextPaymentEntry(
  paymentEntry: ErpnextPaymentEntry
): Promise<ErpnextPaymentEntry> {
  const response = await erpnextFetch<ErpnextMethodResponse<ErpnextPaymentEntry>>(
    "/api/method/frappe.client.submit",
    {
      method: "POST",
      body: JSON.stringify({
        doc: {
          ...paymentEntry,
          doctype: "Payment Entry",
        },
      }),
    }
  );

  return response.message;
}

export async function createAndSubmitErpnextPaymentEntry(
  input: CreatePaymentEntryInput
): Promise<ErpnextPaymentEntry> {
  const salesInvoice = await getErpnextSalesInvoiceDetail(
    input.sales_invoice_name
  );

  if ((salesInvoice.outstanding_amount ?? 0) <= 0) {
    throw new Error("La factura no tiene saldo pendiente.");
  }

  if (!salesInvoice.company) {
    throw new Error("La factura no tiene empresa configurada.");
  }

  // El metodo de pago define a que cuenta entra el dinero.
  // No creamos cuentas automaticamente para evitar afectar el plan contable.
  const paymentAccount = await getErpnextPaymentAccountForMode(
    salesInvoice.company,
    input.mode_of_payment
  );
  const accountCurrency = await getErpnextAccountCurrency(
    paymentAccount,
    salesInvoice.company
  );
  const receivableAccount = salesInvoice.debit_to;
  const receivableAccountCurrency = receivableAccount
    ? await getErpnextAccountCurrency(receivableAccount, salesInvoice.company)
    : salesInvoice.currency ?? salesInvoice.company_currency ?? accountCurrency;
  const postingDate = getTodayDate();
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPaymentEntry>>(
    "/api/resource/Payment%20Entry",
    {
      method: "POST",
      body: JSON.stringify({
        payment_type: "Receive",
        party_type: "Customer",
        party: salesInvoice.customer,
        company: salesInvoice.company,
        posting_date: postingDate,
        mode_of_payment: input.mode_of_payment,
        paid_to: paymentAccount,
        paid_to_account_currency: accountCurrency,
        paid_from: receivableAccount,
        paid_from_account_currency: receivableAccountCurrency,
        paid_amount: input.paid_amount,
        received_amount: input.paid_amount,
        target_exchange_rate: 1,
        reference_no: input.reference_no,
        reference_date: input.reference_date || postingDate,
        remarks: input.note,
        references: [
          {
            reference_doctype: "Sales Invoice",
            reference_name: input.sales_invoice_name,
            allocated_amount: input.paid_amount,
          },
        ],
      }),
    }
  );
  const paymentEntry = response.data;
  const fullPaymentEntry = await getErpnextPaymentEntry(paymentEntry.name);

  try {
    return await submitErpnextPaymentEntry(fullPaymentEntry);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo confirmar el pago por configuracion contable.";

    throw new Error(
      `El pago fue preparado (${paymentEntry.name}) pero no pudo confirmarse por configuracion contable. ${message}`
    );
  }
}
