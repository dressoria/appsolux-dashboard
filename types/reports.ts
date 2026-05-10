export type ReportDateRange = {
  from?: string;
  to?: string;
};

export type DailyAmountReportItem = {
  date: string;
  total_amount: number;
  count: number;
};

export type SalesReportSummary = {
  total_sales_amount: number;
  total_invoices: number;
  paid_invoices: number;
  unpaid_invoices: number;
  cancelled_invoices: number;
  draft_invoices: number;
  outstanding_amount: number;
};

export type PaymentMethodReportItem = {
  mode_of_payment: string;
  total_amount: number;
  count: number;
};

export type PaymentReportSummary = {
  total_paid_amount: number;
  total_payments: number;
  cancelled_payments: number;
  by_method: PaymentMethodReportItem[];
};

export type InventoryReportSummary = {
  total_stock_rows: number;
  low_stock_items: number;
  out_of_stock_items: number;
};

export type ProductSalesReportItem = {
  item_code: string;
  item_name?: string;
  qty_sold: number;
  total_amount: number;
};

export type ProductMovementReportItem = {
  item_code: string;
  item_name?: string;
  qty_sold: number;
  total_amount: number;
};

export type CustomerPurchaseReportItem = {
  customer: string;
  customer_name?: string;
  total_amount: number;
  invoice_count: number;
};

export type CustomerDebtReportItem = {
  customer: string;
  customer_name?: string;
  outstanding_amount: number;
  invoice_count: number;
};

export type SupplierPayableReportItem = {
  supplier: string;
  supplier_name?: string;
  outstanding_amount: number;
  invoice_count: number;
};

export type LowStockReportItem = {
  item_code: string;
  warehouse: string;
  actual_qty: number;
  projected_qty: number;
};

export type PurchaseReportSummary = {
  total_purchases_amount: number;
  total_purchase_invoices: number;
  pending_payables: number;
  outstanding_payable: number;
};

export type ReportsDashboardData = {
  range: Required<ReportDateRange>;
  sales: SalesReportSummary;
  payments: PaymentReportSummary;
  purchases: PurchaseReportSummary;
  inventory: InventoryReportSummary;
  sales_by_day: DailyAmountReportItem[];
  purchases_by_day: DailyAmountReportItem[];
  top_products: ProductSalesReportItem[];
  least_sold_products: ProductMovementReportItem[];
  products_without_sales: ProductMovementReportItem[];
  top_customers: CustomerPurchaseReportItem[];
  customers_with_debt: CustomerDebtReportItem[];
  suppliers_with_payables: SupplierPayableReportItem[];
  low_stock: LowStockReportItem[];
  out_of_stock: LowStockReportItem[];
};
