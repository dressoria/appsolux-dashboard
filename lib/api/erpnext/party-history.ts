import "@/lib/security/server-only";

import { getErpnextCustomers } from "./customers";
import { getErpnextPaymentEntries } from "./payment-entries";
import { getErpnextPurchaseInvoices } from "./purchase-invoices";
import { getErpnextPurchaseOrders } from "./purchase-orders";
import { getErpnextPurchaseReceipts } from "./purchase-receipts";
import { getErpnextQuotations } from "./quotations";
import { getErpnextSalesInvoices } from "./sales-invoices";
import { getErpnextSalesOrders } from "./sales-orders";
import { getErpnextSuppliers } from "./suppliers";
import type {
  ErpnextCustomer,
  ErpnextPaymentEntry,
  ErpnextPurchaseInvoice,
  ErpnextPurchaseOrder,
  ErpnextPurchaseReceipt,
  ErpnextQuotation,
  ErpnextSalesInvoice,
  ErpnextSalesOrder,
  ErpnextSupplier,
} from "@/types/erpnext";

export type CustomerBalanceRow = {
  customer: string;
  customer_name?: string;
  invoice_count: number;
  outstanding_amount: number;
  overdue_amount: number;
  last_invoice?: ErpnextSalesInvoice;
};

export type SupplierBalanceRow = {
  supplier: string;
  supplier_name?: string;
  invoice_count: number;
  outstanding_amount: number;
  overdue_amount: number;
  last_invoice?: ErpnextPurchaseInvoice;
};

export type CustomerHistory = {
  customer?: ErpnextCustomer;
  invoices: ErpnextSalesInvoice[];
  pendingInvoices: ErpnextSalesInvoice[];
  payments: ErpnextPaymentEntry[];
  quotations: ErpnextQuotation[];
  salesOrders: ErpnextSalesOrder[];
  totalInvoiced: number;
  totalPaid: number;
  outstandingAmount: number;
};

export type SupplierHistory = {
  supplier?: ErpnextSupplier;
  invoices: ErpnextPurchaseInvoice[];
  pendingInvoices: ErpnextPurchaseInvoice[];
  payments: ErpnextPaymentEntry[];
  purchaseOrders: ErpnextPurchaseOrder[];
  purchaseReceipts: ErpnextPurchaseReceipt[];
  totalPurchased: number;
  totalPaid: number;
  outstandingAmount: number;
};

function getNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isOverdue(dueDate: string | undefined, today: string) {
  return Boolean(dueDate && dueDate < today);
}

function sortByDateDesc<T extends { posting_date?: string; transaction_date?: string }>(
  rows: T[]
) {
  return [...rows].sort((left, right) => {
    const leftDate = left.posting_date ?? left.transaction_date ?? "";
    const rightDate = right.posting_date ?? right.transaction_date ?? "";
    return rightDate.localeCompare(leftDate);
  });
}

export async function getCustomerHistory(
  customerName: string
): Promise<CustomerHistory> {
  const [customers, invoices, payments, quotations, salesOrders] =
    await Promise.all([
      getErpnextCustomers().catch((): ErpnextCustomer[] => []),
      getErpnextSalesInvoices().catch((): ErpnextSalesInvoice[] => []),
      getErpnextPaymentEntries().catch((): ErpnextPaymentEntry[] => []),
      getErpnextQuotations().catch((): ErpnextQuotation[] => []),
      getErpnextSalesOrders().catch((): ErpnextSalesOrder[] => []),
    ]);
  const customer = customers.find((row) => row.name === customerName);
  const customerInvoices = sortByDateDesc(
    invoices.filter((invoice) => invoice.customer === customerName)
  );
  const customerPayments = sortByDateDesc(
    payments.filter(
      (payment) =>
        payment.payment_type === "Receive" &&
        payment.party_type === "Customer" &&
        payment.party === customerName
    )
  );
  const customerQuotations = [...quotations]
    .filter((quotation) => quotation.party_name === customerName)
    .sort((left, right) =>
      (right.transaction_date ?? "").localeCompare(left.transaction_date ?? "")
    );
  const customerSalesOrders = [...salesOrders]
    .filter((order) => order.customer === customerName)
    .sort((left, right) =>
      (right.transaction_date ?? "").localeCompare(left.transaction_date ?? "")
    );

  return {
    customer,
    invoices: customerInvoices,
    pendingInvoices: customerInvoices.filter(
      (invoice) => invoice.docstatus === 1 && getNumber(invoice.outstanding_amount) > 0
    ),
    payments: customerPayments,
    quotations: customerQuotations,
    salesOrders: customerSalesOrders,
    totalInvoiced: customerInvoices
      .filter((invoice) => invoice.docstatus === 1)
      .reduce((sum, invoice) => sum + getNumber(invoice.grand_total), 0),
    totalPaid: customerInvoices
      .filter((invoice) => invoice.docstatus === 1)
      .reduce((sum, invoice) => sum + getNumber(invoice.paid_amount), 0),
    outstandingAmount: customerInvoices
      .filter((invoice) => invoice.docstatus === 1)
      .reduce((sum, invoice) => sum + getNumber(invoice.outstanding_amount), 0),
  };
}

export async function getSupplierHistory(
  supplierName: string
): Promise<SupplierHistory> {
  const [suppliers, invoices, payments, purchaseOrders, purchaseReceipts] =
    await Promise.all([
      getErpnextSuppliers().catch((): ErpnextSupplier[] => []),
      getErpnextPurchaseInvoices().catch((): ErpnextPurchaseInvoice[] => []),
      getErpnextPaymentEntries().catch((): ErpnextPaymentEntry[] => []),
      getErpnextPurchaseOrders().catch((): ErpnextPurchaseOrder[] => []),
      getErpnextPurchaseReceipts().catch((): ErpnextPurchaseReceipt[] => []),
    ]);
  const supplier = suppliers.find((row) => row.name === supplierName);
  const supplierInvoices = sortByDateDesc(
    invoices.filter((invoice) => invoice.supplier === supplierName)
  );
  const supplierPayments = sortByDateDesc(
    payments.filter(
      (payment) =>
        payment.payment_type === "Pay" &&
        payment.party_type === "Supplier" &&
        payment.party === supplierName
    )
  );
  const supplierPurchaseOrders = [...purchaseOrders]
    .filter((order) => order.supplier === supplierName)
    .sort((left, right) =>
      (right.transaction_date ?? "").localeCompare(left.transaction_date ?? "")
    );
  const supplierPurchaseReceipts = sortByDateDesc(
    purchaseReceipts.filter((receipt) => receipt.supplier === supplierName)
  );

  return {
    supplier,
    invoices: supplierInvoices,
    pendingInvoices: supplierInvoices.filter(
      (invoice) => invoice.docstatus === 1 && getNumber(invoice.outstanding_amount) > 0
    ),
    payments: supplierPayments,
    purchaseOrders: supplierPurchaseOrders,
    purchaseReceipts: supplierPurchaseReceipts,
    totalPurchased: supplierInvoices
      .filter((invoice) => invoice.docstatus === 1)
      .reduce((sum, invoice) => sum + getNumber(invoice.grand_total), 0),
    totalPaid: supplierInvoices
      .filter((invoice) => invoice.docstatus === 1)
      .reduce((sum, invoice) => sum + getNumber(invoice.paid_amount), 0),
    outstandingAmount: supplierInvoices
      .filter((invoice) => invoice.docstatus === 1)
      .reduce((sum, invoice) => sum + getNumber(invoice.outstanding_amount), 0),
  };
}

export async function getCustomerBalances(): Promise<CustomerBalanceRow[]> {
  const invoices = await getErpnextSalesInvoices().catch(
    (): ErpnextSalesInvoice[] => []
  );
  const today = new Date().toISOString().slice(0, 10);
  const rows = new Map<string, CustomerBalanceRow>();

  for (const invoice of invoices) {
    const outstanding = getNumber(invoice.outstanding_amount);
    if (invoice.docstatus !== 1 || outstanding <= 0) continue;

    const current = rows.get(invoice.customer) ?? {
      customer: invoice.customer,
      customer_name: invoice.customer_name,
      invoice_count: 0,
      outstanding_amount: 0,
      overdue_amount: 0,
      last_invoice: undefined,
    };
    current.invoice_count += 1;
    current.outstanding_amount += outstanding;
    current.overdue_amount += isOverdue(invoice.due_date, today) ? outstanding : 0;
    if (
      !current.last_invoice?.posting_date ||
      (invoice.posting_date ?? "") > current.last_invoice.posting_date
    ) {
      current.last_invoice = invoice;
    }
    rows.set(invoice.customer, current);
  }

  return Array.from(rows.values()).sort(
    (left, right) => right.outstanding_amount - left.outstanding_amount
  );
}

export async function getSupplierBalances(): Promise<SupplierBalanceRow[]> {
  const invoices = await getErpnextPurchaseInvoices().catch(
    (): ErpnextPurchaseInvoice[] => []
  );
  const today = new Date().toISOString().slice(0, 10);
  const rows = new Map<string, SupplierBalanceRow>();

  for (const invoice of invoices) {
    const outstanding = getNumber(invoice.outstanding_amount);
    if (invoice.docstatus !== 1 || outstanding <= 0) continue;

    const current = rows.get(invoice.supplier) ?? {
      supplier: invoice.supplier,
      supplier_name: invoice.supplier_name,
      invoice_count: 0,
      outstanding_amount: 0,
      overdue_amount: 0,
      last_invoice: undefined,
    };
    current.invoice_count += 1;
    current.outstanding_amount += outstanding;
    current.overdue_amount += isOverdue(invoice.due_date, today) ? outstanding : 0;
    if (
      !current.last_invoice?.posting_date ||
      (invoice.posting_date ?? "") > current.last_invoice.posting_date
    ) {
      current.last_invoice = invoice;
    }
    rows.set(invoice.supplier, current);
  }

  return Array.from(rows.values()).sort(
    (left, right) => right.outstanding_amount - left.outstanding_amount
  );
}
