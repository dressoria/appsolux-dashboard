export type ErpnextListResponse<T> = {
  data: T[];
};

export type ErpnextCreateResponse<T> = {
  data: T;
};

export type ErpnextMethodResponse<T> = {
  message: T;
};

export type ErpnextDeleteResponse = {
  message?: string;
};

export type ErpnextItem = {
  name: string;
  item_name: string;
  item_code: string;
  item_group?: string;
  stock_uom?: string;
  disabled?: 0 | 1;
  is_stock_item?: 0 | 1;
};

export type CreateErpnextItemInput = {
  item_code: string;
  item_name: string;
  stock_uom: string;
  item_group: string;
  is_stock_item?: boolean;
};

export type ErpnextWarehouse = {
  name: string;
  warehouse_name: string;
  company?: string;
  disabled?: 0 | 1;
  is_group?: 0 | 1;
};

export type CreateErpnextWarehouseInput = {
  warehouse_name: string;
  company?: string;
};

export type ErpnextBin = {
  name: string;
  item_code: string;
  warehouse: string;
  actual_qty?: number;
  reserved_qty?: number;
  projected_qty?: number;
};

export type ErpnextCustomer = {
  name: string;
  customer_name: string;
  customer_type?: string;
  territory?: string;
  disabled?: 0 | 1;
};

export type CreateErpnextCustomerInput = {
  customer_name: string;
  customer_type?: string;
  territory: string;
};

export type ErpnextItemGroup = {
  name: string;
  item_group_name?: string;
  is_group?: 0 | 1;
};

export type ErpnextUom = {
  name: string;
  uom_name?: string;
};

export type ErpnextTerritory = {
  name: string;
  territory_name?: string;
  is_group?: 0 | 1;
};

export type ErpnextCompany = {
  name: string;
  company_name?: string;
  default_currency?: string;
};

export type ErpnextMasters = {
  itemGroups: ErpnextItemGroup[];
  uoms: ErpnextUom[];
  territories: ErpnextTerritory[];
  companies: ErpnextCompany[];
};

export type ErpnextStockEntryItem = {
  item_code: string;
  t_warehouse?: string;
  s_warehouse?: string;
  qty: number;
  basic_rate: number;
};

export type ErpnextStockEntry = {
  name: string;
  doctype?: "Stock Entry";
  stock_entry_type?: string;
  purpose?: string;
  docstatus?: 0 | 1 | 2;
  items?: ErpnextStockEntryItem[];
};

export type CreateStockEntryInput = {
  item_code: string;
  warehouse: string;
  qty: number;
  basic_rate?: number;
};

export type CreateStockAdjustmentInput = {
  item_code: string;
  warehouse: string;
  counted_qty: number;
  reason: string;
  note?: string;
};

export type StockAdjustmentResult = {
  item_code: string;
  warehouse: string;
  previous_qty: number;
  counted_qty: number;
  difference: number;
  document_name: string | null;
};

export type ErpnextStockLedgerEntry = {
  name: string;
  posting_date?: string;
  posting_time?: string;
  item_code: string;
  warehouse: string;
  actual_qty?: number;
  qty_after_transaction?: number;
  voucher_type?: string;
  voucher_no?: string;
};

export type ErpnextSalesOrderItem = {
  name?: string;
  item_code: string;
  item_name?: string;
  qty: number;
  rate: number;
  amount?: number;
  warehouse?: string;
};

export type ErpnextSalesOrder = {
  name: string;
  customer: string;
  customer_name?: string;
  transaction_date?: string;
  delivery_date?: string;
  status?: string;
  docstatus?: 0 | 1 | 2;
  grand_total?: number;
  net_total?: number;
  company: string;
  items?: ErpnextSalesOrderItem[];
};

export type ErpnextSalesOrderDetail = ErpnextSalesOrder;

export type CreateSalesOrderItemInput = {
  item_code: string;
  qty: number;
  rate: number;
  warehouse?: string;
};

export type CreateSalesOrderInput = {
  customer: string;
  company: string;
  warehouse: string;
  items: CreateSalesOrderItemInput[];
  note?: string;
};

export type PosCartItem = {
  item_code: string;
  item_name: string;
  stock_uom?: string;
  qty: number;
  rate: number;
};

export type PosCheckoutItemInput = {
  item_code: string;
  qty: number;
  rate: number;
  warehouse?: string;
};

export type ErpnextSalesInvoiceItem = {
  doctype?: "Sales Invoice Item";
  name?: string;
  item_code: string;
  item_name?: string;
  qty: number;
  rate: number;
  amount?: number;
  warehouse?: string;
  sales_order?: string;
  so_detail?: string;
};

export type ErpnextSalesInvoice = {
  doctype?: "Sales Invoice";
  name: string;
  customer: string;
  customer_name?: string;
  posting_date?: string;
  due_date?: string;
  grand_total?: number;
  outstanding_amount?: number;
  paid_amount?: number;
  status?: string;
  docstatus?: 0 | 1 | 2;
  company?: string;
  debit_to?: string;
  currency?: string;
  company_currency?: string;
  remarks?: string;
  items?: ErpnextSalesInvoiceItem[];
};

export type ErpnextSalesInvoiceDetail = ErpnextSalesInvoice;

export type CreateSalesInvoiceFromOrderInput = {
  sales_order_name: string;
};

export type UpdateSalesInvoiceDraftItemInput = {
  name?: string;
  item_code: string;
  qty: number;
  rate: number;
  warehouse?: string;
};

export type UpdateSalesInvoiceDraftInput = {
  due_date?: string;
  remarks?: string;
  items?: UpdateSalesInvoiceDraftItemInput[];
};

export type CancelSalesInvoiceInput = {
  reason?: string;
};

export type DeleteSalesInvoiceInput = {
  name: string;
};

export type SalesInvoiceActionResult = {
  sales_invoice: {
    name: string;
    status?: string;
    docstatus?: 0 | 1 | 2;
  };
};

export type ErpnextPaymentEntry = {
  name: string;
  payment_type?: "Receive" | "Pay" | "Internal Transfer";
  party_type?: string;
  party?: string;
  paid_amount?: number;
  received_amount?: number;
  mode_of_payment?: string;
  paid_to?: string;
  paid_to_account_currency?: string;
  paid_from?: string;
  paid_from_account_currency?: string;
  posting_date?: string;
  status?: string;
  docstatus?: 0 | 1 | 2;
};

export type ErpnextModeOfPaymentAccount = {
  company?: string;
  default_account?: string;
  account?: string;
};

export type ErpnextModeOfPayment = {
  name: string;
  type?: string;
  enabled?: boolean | 0 | 1;
  accounts?: ErpnextModeOfPaymentAccount[];
};

export type ErpnextAccount = {
  name: string;
  account_currency?: string;
};

export type CreatePaymentEntryInput = {
  sales_invoice_name: string;
  paid_amount: number;
  mode_of_payment: string;
  reference_no?: string;
  reference_date?: string;
  note?: string;
};

export type PosCheckoutInput = {
  customer: string;
  company: string;
  warehouse: string;
  mode_of_payment: string;
  paid_amount: number;
  items: PosCheckoutItemInput[];
  note?: string;
  reference_no?: string;
  reference_date?: string;
};

export type PosCheckoutInvoiceResult = {
  name: string;
  customer: string;
  grand_total?: number;
  status?: string;
  docstatus?: 0 | 1 | 2;
};

export type PosCheckoutPaymentResult = {
  name: string;
  paid_amount?: number;
  mode_of_payment?: string;
  party?: string;
  status?: string;
  docstatus?: 0 | 1 | 2;
};

export type PosCheckoutResult = {
  invoice: PosCheckoutInvoiceResult;
  payment: PosCheckoutPaymentResult;
};

export type ErpnextPaymentSummary = {
  sales_invoice_name: string;
  outstanding_amount: number;
  paid_amount: number;
};

export type ErpnextInvoice = {
  name: string;
  customer: string;
  posting_date?: string;
  due_date?: string;
  grand_total?: number;
  outstanding_amount?: number;
  status?: string;
};
