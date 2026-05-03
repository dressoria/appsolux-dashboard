export type ErpnextListResponse<T> = {
  data: T[];
};

export type ErpnextCreateResponse<T> = {
  data: T;
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
  t_warehouse: string;
  qty: number;
  basic_rate: number;
};

export type ErpnextStockEntry = {
  name: string;
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

export type ErpnextInvoice = {
  name: string;
  customer: string;
  posting_date?: string;
  due_date?: string;
  grand_total?: number;
  outstanding_amount?: number;
  status?: string;
};
