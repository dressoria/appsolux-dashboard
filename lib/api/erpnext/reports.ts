import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextBin,
  ErpnextListResponse,
  ErpnextPaymentEntry,
  ErpnextSalesInvoice,
} from "@/types/erpnext";
import type {
  LowStockReportItem,
  PaymentMethodReportItem,
  ProductSalesReportItem,
  ReportDateRange,
  ReportsDashboardData,
} from "@/types/reports";

const salesInvoiceFields = [
  "name",
  "customer",
  "customer_name",
  "posting_date",
  "status",
  "docstatus",
  "grand_total",
  "outstanding_amount",
  "paid_amount",
  "company",
];

const paymentEntryFields = [
  "name",
  "posting_date",
  "mode_of_payment",
  "paid_amount",
  "received_amount",
  "docstatus",
  "status",
  "company",
];

const binFields = [
  "name",
  "item_code",
  "warehouse",
  "actual_qty",
  "reserved_qty",
  "projected_qty",
];

function getDateFilters(range?: ReportDateRange) {
  const filters: unknown[] = [];

  if (range?.from) {
    filters.push(["posting_date", ">=", range.from]);
  }

  if (range?.to) {
    filters.push(["posting_date", "<=", range.to]);
  }

  return filters;
}

function getNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getSalesInvoicesForReports(
  range?: ReportDateRange
): Promise<ErpnextSalesInvoice[]> {
  const filters = getDateFilters(range);
  const params = new URLSearchParams({
    fields: JSON.stringify(salesInvoiceFields),
    limit_page_length: "100",
    order_by: "posting_date desc, modified desc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<ErpnextListResponse<ErpnextSalesInvoice>>(
    `/api/resource/Sales%20Invoice?${params.toString()}`
  );

  return response.data;
}

export async function getPaymentEntriesForReports(
  range?: ReportDateRange
): Promise<ErpnextPaymentEntry[]> {
  const filters = getDateFilters(range);
  const params = new URLSearchParams({
    fields: JSON.stringify(paymentEntryFields),
    limit_page_length: "100",
    order_by: "posting_date desc, modified desc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<ErpnextListResponse<ErpnextPaymentEntry>>(
    `/api/resource/Payment%20Entry?${params.toString()}`
  );

  return response.data;
}

export async function getInventoryForReports(): Promise<ErpnextBin[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(binFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextBin>>(
    `/api/resource/Bin?${params.toString()}`
  );

  return response.data;
}

async function getInvoiceItemsForReports(
  invoices: ErpnextSalesInvoice[]
): Promise<ProductSalesReportItem[]> {
  const activeInvoices = invoices.filter((invoice) => invoice.docstatus !== 2);
  const invoiceDetails = await Promise.all(
    activeInvoices.map((invoice) =>
      erpnextFetch<{ data: ErpnextSalesInvoice }>(
        `/api/resource/Sales%20Invoice/${encodeURIComponent(invoice.name)}`
      )
    )
  );
  const productMap = new Map<string, ProductSalesReportItem>();

  invoiceDetails.forEach((response) => {
    (response.data.items ?? []).forEach((item) => {
      const current = productMap.get(item.item_code) ?? {
        item_code: item.item_code,
        item_name: item.item_name,
        qty_sold: 0,
        total_amount: 0,
      };

      current.qty_sold += getNumber(item.qty);
      current.total_amount += getNumber(item.amount);
      productMap.set(item.item_code, current);
    });
  });

  return Array.from(productMap.values())
    .sort((left, right) => right.total_amount - left.total_amount)
    .slice(0, 10);
}

function buildPaymentMethods(
  payments: ErpnextPaymentEntry[]
): PaymentMethodReportItem[] {
  const methodMap = new Map<string, PaymentMethodReportItem>();

  payments
    .filter((payment) => payment.docstatus === 1)
    .forEach((payment) => {
      const modeOfPayment = payment.mode_of_payment ?? "Sin metodo";
      const amount = getNumber(payment.paid_amount ?? payment.received_amount);
      const current = methodMap.get(modeOfPayment) ?? {
        mode_of_payment: modeOfPayment,
        total_amount: 0,
        count: 0,
      };

      current.total_amount += amount;
      current.count += 1;
      methodMap.set(modeOfPayment, current);
    });

  return Array.from(methodMap.values()).sort(
    (left, right) => right.total_amount - left.total_amount
  );
}

function buildStockRows(inventory: ErpnextBin[], outOfStock: boolean) {
  return inventory
    .filter((bin) => {
      const actualQty = getNumber(bin.actual_qty);

      return outOfStock ? actualQty <= 0 : actualQty > 0 && actualQty <= 5;
    })
    .map<LowStockReportItem>((bin) => ({
      item_code: bin.item_code,
      warehouse: bin.warehouse,
      actual_qty: getNumber(bin.actual_qty),
      projected_qty: getNumber(bin.projected_qty),
    }))
    .sort((left, right) => left.actual_qty - right.actual_qty)
    .slice(0, 20);
}

export async function buildReportsDashboardData(
  range?: ReportDateRange
): Promise<ReportsDashboardData> {
  const [salesInvoices, paymentEntries, inventory] = await Promise.all([
    getSalesInvoicesForReports(range),
    getPaymentEntriesForReports(range),
    getInventoryForReports(),
  ]);
  const topProducts = await getInvoiceItemsForReports(salesInvoices);
  const activeInvoices = salesInvoices.filter(
    (invoice) => invoice.docstatus !== 2
  );
  const submittedInvoices = salesInvoices.filter(
    (invoice) => invoice.docstatus === 1
  );
  const paidInvoices = submittedInvoices.filter(
    (invoice) => getNumber(invoice.outstanding_amount) <= 0
  );
  const unpaidInvoices = submittedInvoices.filter(
    (invoice) => getNumber(invoice.outstanding_amount) > 0
  );
  const activePayments = paymentEntries.filter(
    (payment) => payment.docstatus === 1
  );
  const lowStock = buildStockRows(inventory, false);
  const outOfStock = buildStockRows(inventory, true);

  return {
    sales: {
      total_sales_amount: activeInvoices.reduce(
        (sum, invoice) => sum + getNumber(invoice.grand_total),
        0
      ),
      total_invoices: salesInvoices.length,
      paid_invoices: paidInvoices.length,
      unpaid_invoices: unpaidInvoices.length,
      cancelled_invoices: salesInvoices.filter(
        (invoice) => invoice.docstatus === 2
      ).length,
      draft_invoices: salesInvoices.filter((invoice) => invoice.docstatus === 0)
        .length,
      outstanding_amount: unpaidInvoices.reduce(
        (sum, invoice) => sum + getNumber(invoice.outstanding_amount),
        0
      ),
    },
    payments: {
      total_paid_amount: activePayments.reduce(
        (sum, payment) =>
          sum + getNumber(payment.paid_amount ?? payment.received_amount),
        0
      ),
      total_payments: paymentEntries.length,
      cancelled_payments: paymentEntries.filter(
        (payment) => payment.docstatus === 2
      ).length,
      by_method: buildPaymentMethods(paymentEntries),
    },
    inventory: {
      total_stock_rows: inventory.length,
      low_stock_items: lowStock.length,
      out_of_stock_items: outOfStock.length,
    },
    top_products: topProducts,
    low_stock: lowStock,
    out_of_stock: outOfStock,
  };
}
