export type ReportDateRange = {
  from?: string;
  to?: string;
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
  sales: SalesReportSummary;
  payments: PaymentReportSummary;
  purchases: PurchaseReportSummary;
  inventory: InventoryReportSummary;
  top_products: ProductSalesReportItem[];
  low_stock: LowStockReportItem[];
  out_of_stock: LowStockReportItem[];
};
