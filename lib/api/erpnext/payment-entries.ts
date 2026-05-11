import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { cancelErpnextDocument } from "./documents";
import { getErpnextAccountCurrency } from "./accounts";
import { getErpnextPaymentAccountMappingForMode } from "./modes-of-payment";
import { getErpnextSalesInvoiceDetail } from "./sales-invoices";
import { getErpnextPurchaseInvoiceDetail } from "./purchase-invoices";
import type {
  CreatePaymentEntryInput,
  CreateSupplierPaymentEntryInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextMethodResponse,
  ErpnextPaymentEntry,
} from "@/types/erpnext";

const paymentEntryFields = [
  "name",
  "posting_date",
  "payment_type",
  "party_type",
  "party",
  "party_name",
  "mode_of_payment",
  "paid_from",
  "paid_to",
  "paid_amount",
  "received_amount",
  "company",
  "status",
  "docstatus",
  "reference_no",
  "reference_date",
  "remarks",
];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getPaymentEntryPath(name: string) {
  return `/api/resource/Payment%20Entry/${encodeURIComponent(name)}`;
}

export async function getErpnextPaymentEntries(): Promise<ErpnextPaymentEntry[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(paymentEntryFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextPaymentEntry>>(
    `/api/resource/Payment%20Entry?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextPaymentEntry(
  name: string
): Promise<ErpnextPaymentEntry> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPaymentEntry>>(
    getPaymentEntryPath(name)
  );

  return response.data;
}

export async function getErpnextPaymentEntryDetail(
  name: string
): Promise<ErpnextPaymentEntry> {
  return getErpnextPaymentEntry(name);
}

export async function getPaymentEntriesForSalesInvoice(
  salesInvoiceName: string
): Promise<ErpnextPaymentEntry[]> {
  // Filter directly on the child table to avoid N+1: only fetch Payment Entries
  // that actually reference this sales invoice (typically 1-3 results).
  const filters = JSON.stringify([
    ["Payment Entry Reference", "reference_name", "=", salesInvoiceName],
    ["Payment Entry Reference", "reference_doctype", "=", "Sales Invoice"],
  ]);
  const params = new URLSearchParams({
    fields: JSON.stringify(["name"]),
    filters,
    limit_page_length: "20",
  });
  const listResponse = await erpnextFetch<ErpnextListResponse<{ name: string }>>(
    `/api/resource/Payment%20Entry?${params.toString()}`
  );
  const names = listResponse.data.map((r) => r.name);
  if (names.length === 0) return [];
  return Promise.all(names.map((name) => getErpnextPaymentEntryDetail(name)));
}

export async function cancelErpnextPaymentEntry(
  name: string
): Promise<ErpnextPaymentEntry> {
  await cancelErpnextDocument("Payment Entry", name);

  return getErpnextPaymentEntryDetail(name);
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

export async function createErpnextSupplierPaymentEntry(
  input: CreateSupplierPaymentEntryInput
): Promise<ErpnextPaymentEntry> {
  const purchaseInvoice = await getErpnextPurchaseInvoiceDetail(
    input.purchase_invoice_name
  );

  if ((purchaseInvoice.outstanding_amount ?? 0) <= 0) {
    throw new Error("La factura no tiene saldo pendiente.");
  }

  if (!purchaseInvoice.company) {
    throw new Error("La factura no tiene empresa configurada.");
  }

  if (!purchaseInvoice.credit_to) {
    throw new Error(
      "La factura no tiene cuenta por pagar configurada. Confirma la factura en el ERP primero."
    );
  }

  const paymentAccountMapping = await getErpnextPaymentAccountMappingForMode(
    purchaseInvoice.company,
    input.mode_of_payment
  );
  const paymentAccount = paymentAccountMapping.account;
  const accountCurrency = paymentAccountMapping.account_currency;

  if (!accountCurrency) {
    throw new Error("La cuenta asociada al metodo de pago no tiene moneda.");
  }

  const payableAccountCurrency = await getErpnextAccountCurrency(
    purchaseInvoice.credit_to,
    purchaseInvoice.company
  );

  const postingDate = getTodayDate();
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPaymentEntry>>(
    "/api/resource/Payment%20Entry",
    {
      method: "POST",
      body: JSON.stringify({
        payment_type: "Pay",
        party_type: "Supplier",
        party: purchaseInvoice.supplier,
        company: purchaseInvoice.company,
        posting_date: postingDate,
        mode_of_payment: input.mode_of_payment,
        paid_from: paymentAccount,
        paid_from_account_currency: accountCurrency,
        paid_to: purchaseInvoice.credit_to,
        paid_to_account_currency: payableAccountCurrency,
        paid_amount: input.paid_amount,
        received_amount: input.paid_amount,
        target_exchange_rate: 1,
        reference_no: input.reference_no,
        reference_date: input.reference_date || postingDate,
        remarks: input.note,
        references: [
          {
            reference_doctype: "Purchase Invoice",
            reference_name: input.purchase_invoice_name,
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
      `El pago fue preparado (${paymentEntry.name}) pero no pudo confirmarse. ${message}`
    );
  }
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
  const paymentAccountMapping = await getErpnextPaymentAccountMappingForMode(
    salesInvoice.company,
    input.mode_of_payment
  );
  const paymentAccount = paymentAccountMapping.account;
  const accountCurrency = paymentAccountMapping.account_currency;

  if (!accountCurrency) {
    throw new Error("La cuenta asociada al metodo de pago no tiene moneda.");
  }
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
