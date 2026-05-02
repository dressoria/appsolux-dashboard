export type ErpnextCustomer = {
  name: string;
  customer_name: string;
  customer_type?: string;
  territory?: string;
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