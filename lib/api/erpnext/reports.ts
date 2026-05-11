import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextBin,
  ErpnextItem,
  ErpnextListResponse,
  ErpnextPaymentEntry,
  ErpnextPurchaseInvoice,
  ErpnextSalesInvoiceItem,
  ErpnextSalesInvoice,
} from "@/types/erpnext";
import type {
  CustomerDebtReportItem,
  CustomerPurchaseReportItem,
  DailyAmountReportItem,
  LowStockReportItem,
  PaymentMethodReportItem,
  ProductMovementReportItem,
  ProductSalesReportItem,
  PurchaseReportSummary,
  ReportDateRange,
  ReportsDashboardData,
  SupplierPayableReportItem,
} from "@/types/reports";

const salesInvoiceFields = [
  "name",
  "customer",
  "customer_name",
  "posting_date",
  "due_date",
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

const purchaseInvoiceFields = [
  "name",
  "supplier",
  "supplier_name",
  "posting_date",
  "due_date",
  "grand_total",
  "outstanding_amount",
  "status",
  "docstatus",
  "company",
];

const salesInvoiceItemFields = [
  "parent",
  "item_code",
  "item_name",
  "qty",
  "amount",
];

const itemFields = ["name", "item_code", "item_name", "disabled"];

type SalesInvoiceItemReportRow = ErpnextSalesInvoiceItem & {
  parent: string;
};

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

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(dueDate: string | undefined, today: string) {
  return Boolean(dueDate && dueDate < today);
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

export async function getPurchaseInvoicesForReports(
  range?: ReportDateRange
): Promise<ErpnextPurchaseInvoice[]> {
  const filters = getDateFilters(range);
  const params = new URLSearchParams({
    fields: JSON.stringify(purchaseInvoiceFields),
    limit_page_length: "100",
    order_by: "posting_date desc, modified desc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<
    ErpnextListResponse<ErpnextPurchaseInvoice>
  >(`/api/resource/Purchase%20Invoice?${params.toString()}`);

  return response.data;
}

export async function getItemsForReports(): Promise<ErpnextItem[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(itemFields),
    filters: JSON.stringify([["disabled", "=", 0]]),
    limit_page_length: "200",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextItem>>(
    `/api/resource/Item?${params.toString()}`
  );

  return response.data;
}

function buildPurchaseSummary(
  invoices: ErpnextPurchaseInvoice[]
): PurchaseReportSummary {
  const submitted = invoices.filter((inv) => inv.docstatus === 1);
  const pending = submitted.filter(
    (inv) => getNumber(inv.outstanding_amount) > 0
  );

  return {
    total_purchases_amount: submitted.reduce(
      (sum, inv) => sum + getNumber(inv.grand_total),
      0
    ),
    total_purchase_invoices: invoices.length,
    pending_payables: pending.length,
    outstanding_payable: pending.reduce(
      (sum, inv) => sum + getNumber(inv.outstanding_amount),
      0
    ),
  };
}

async function getInvoiceItemsForReports(
  invoices: ErpnextSalesInvoice[]
): Promise<SalesInvoiceItemReportRow[]> {
  const activeInvoices = invoices.filter((invoice) => invoice.docstatus !== 2);
  const invoiceNames = activeInvoices.map((invoice) => invoice.name).slice(0, 100);

  if (invoiceNames.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    fields: JSON.stringify(salesInvoiceItemFields),
    filters: JSON.stringify([["parent", "in", invoiceNames]]),
    limit_page_length: "500",
  });

  const response = await erpnextFetch<
    ErpnextListResponse<SalesInvoiceItemReportRow>
  >(`/api/resource/Sales%20Invoice%20Item?${params.toString()}`);

  return response.data;
}

function buildProductSalesRows(
  items: SalesInvoiceItemReportRow[]
): ProductSalesReportItem[] {
  const productMap = new Map<string, ProductSalesReportItem>();

  items.forEach((item) => {
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

  return Array.from(productMap.values())
    .sort((left, right) => right.total_amount - left.total_amount);
}

function buildLeastSoldProducts(
  productRows: ProductSalesReportItem[]
): ProductMovementReportItem[] {
  return [...productRows]
    .filter((product) => product.qty_sold > 0)
    .sort((left, right) => left.qty_sold - right.qty_sold)
    .slice(0, 10);
}

function buildProductsWithoutSales(
  items: ErpnextItem[],
  productRows: ProductSalesReportItem[]
): ProductMovementReportItem[] {
  const soldCodes = new Set(productRows.map((product) => product.item_code));

  return items
    .filter((item) => !soldCodes.has(item.item_code))
    .slice(0, 20)
    .map((item) => ({
      item_code: item.item_code,
      item_name: item.item_name,
      qty_sold: 0,
      total_amount: 0,
    }));
}

function buildDailyAmounts<T extends { posting_date?: string; grand_total?: number }>(
  rows: T[]
): DailyAmountReportItem[] {
  const dayMap = new Map<string, DailyAmountReportItem>();

  rows.forEach((row) => {
    if (!row.posting_date) {
      return;
    }

    const current = dayMap.get(row.posting_date) ?? {
      date: row.posting_date,
      total_amount: 0,
      count: 0,
    };

    current.total_amount += getNumber(row.grand_total);
    current.count += 1;
    dayMap.set(row.posting_date, current);
  });

  return Array.from(dayMap.values()).sort((left, right) =>
    left.date.localeCompare(right.date)
  );
}

function buildTopCustomers(
  invoices: ErpnextSalesInvoice[]
): CustomerPurchaseReportItem[] {
  const customerMap = new Map<string, CustomerPurchaseReportItem>();

  invoices
    .filter((invoice) => invoice.docstatus === 1)
    .forEach((invoice) => {
      const customer = invoice.customer;
      const current = customerMap.get(customer) ?? {
        customer,
        customer_name: invoice.customer_name,
        total_amount: 0,
        invoice_count: 0,
      };

      current.total_amount += getNumber(invoice.grand_total);
      current.invoice_count += 1;
      customerMap.set(customer, current);
    });

  return Array.from(customerMap.values())
    .sort((left, right) => right.total_amount - left.total_amount)
    .slice(0, 10);
}

function buildCustomerDebts(
  invoices: ErpnextSalesInvoice[]
): CustomerDebtReportItem[] {
  const customerMap = new Map<string, CustomerDebtReportItem>();
  const today = getTodayDate();

  invoices
    .filter(
      (invoice) =>
        invoice.docstatus === 1 && getNumber(invoice.outstanding_amount) > 0
    )
    .forEach((invoice) => {
      const customer = invoice.customer;
      const current = customerMap.get(customer) ?? {
        customer,
        customer_name: invoice.customer_name,
        outstanding_amount: 0,
        overdue_amount: 0,
        invoice_count: 0,
        last_invoice: undefined,
      };

      current.outstanding_amount += getNumber(invoice.outstanding_amount);
      current.overdue_amount += isOverdue(invoice.due_date, today)
        ? getNumber(invoice.outstanding_amount)
        : 0;
      current.invoice_count += 1;
      if (
        !current.last_invoice ||
        (invoice.posting_date ?? "") >
          (invoices.find((row) => row.name === current.last_invoice)?.posting_date ?? "")
      ) {
        current.last_invoice = invoice.name;
      }
      customerMap.set(customer, current);
    });

  return Array.from(customerMap.values())
    .sort((left, right) => right.outstanding_amount - left.outstanding_amount)
    .slice(0, 10);
}

function buildSupplierPayables(
  invoices: ErpnextPurchaseInvoice[]
): SupplierPayableReportItem[] {
  const supplierMap = new Map<string, SupplierPayableReportItem>();
  const today = getTodayDate();

  invoices
    .filter(
      (invoice) =>
        invoice.docstatus === 1 && getNumber(invoice.outstanding_amount) > 0
    )
    .forEach((invoice) => {
      const supplier = invoice.supplier;
      const current = supplierMap.get(supplier) ?? {
        supplier,
        supplier_name: invoice.supplier_name,
        outstanding_amount: 0,
        overdue_amount: 0,
        invoice_count: 0,
        last_invoice: undefined,
      };

      current.outstanding_amount += getNumber(invoice.outstanding_amount);
      current.overdue_amount += isOverdue(invoice.due_date, today)
        ? getNumber(invoice.outstanding_amount)
        : 0;
      current.invoice_count += 1;
      if (
        !current.last_invoice ||
        (invoice.posting_date ?? "") >
          (invoices.find((row) => row.name === current.last_invoice)?.posting_date ?? "")
      ) {
        current.last_invoice = invoice.name;
      }
      supplierMap.set(supplier, current);
    });

  return Array.from(supplierMap.values())
    .sort((left, right) => right.outstanding_amount - left.outstanding_amount)
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
  const [salesInvoices, paymentEntries, inventory, purchaseInvoices] =
    await Promise.all([
      getSalesInvoicesForReports(range),
      getPaymentEntriesForReports(range),
      getInventoryForReports(),
      getPurchaseInvoicesForReports(range).catch(
        (): ErpnextPurchaseInvoice[] => []
      ),
    ]);
  const [invoiceItems, items] = await Promise.all([
    getInvoiceItemsForReports(salesInvoices).catch(
      (): SalesInvoiceItemReportRow[] => []
    ),
    getItemsForReports().catch((): ErpnextItem[] => []),
  ]);
  const productRows = buildProductSalesRows(invoiceItems);
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
    range: {
      from: range?.from ?? "",
      to: range?.to ?? "",
    },
    purchases: buildPurchaseSummary(purchaseInvoices),
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
    sales_by_day: buildDailyAmounts(
      salesInvoices.filter((invoice) => invoice.docstatus !== 2)
    ),
    purchases_by_day: buildDailyAmounts(
      purchaseInvoices.filter((invoice) => invoice.docstatus !== 2)
    ),
    top_products: productRows.slice(0, 10),
    least_sold_products: buildLeastSoldProducts(productRows),
    products_without_sales: buildProductsWithoutSales(items, productRows),
    top_customers: buildTopCustomers(salesInvoices),
    customers_with_debt: buildCustomerDebts(salesInvoices),
    suppliers_with_payables: buildSupplierPayables(purchaseInvoices),
    low_stock: lowStock,
    out_of_stock: outOfStock,
  };
}
