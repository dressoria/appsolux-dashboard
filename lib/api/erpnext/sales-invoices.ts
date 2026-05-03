import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { getErpnextSalesOrderDetail } from "./sales-orders";
import type {
  CreateSalesInvoiceFromOrderInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextMethodResponse,
  ErpnextSalesInvoice,
} from "@/types/erpnext";

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

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function getErpnextSalesInvoices(): Promise<
  ErpnextSalesInvoice[]
> {
  const params = new URLSearchParams({
    fields: JSON.stringify(salesInvoiceFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextSalesInvoice>>(
    `/api/resource/Sales%20Invoice?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextSalesInvoiceDetail(
  name: string
): Promise<ErpnextSalesInvoice> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesInvoice>>(
    `/api/resource/Sales%20Invoice/${encodeURIComponent(name)}`
  );

  return response.data;
}

export async function submitErpnextSalesInvoice(
  salesInvoice: ErpnextSalesInvoice
): Promise<ErpnextSalesInvoice> {
  const response = await erpnextFetch<ErpnextMethodResponse<ErpnextSalesInvoice>>(
    "/api/method/frappe.client.submit",
    {
      method: "POST",
      body: JSON.stringify({
        doc: {
          ...salesInvoice,
          doctype: "Sales Invoice",
        },
      }),
    }
  );

  return response.message;
}

export async function createSalesInvoiceFromSalesOrder(
  input: CreateSalesInvoiceFromOrderInput
): Promise<ErpnextSalesInvoice> {
  const salesOrder = await getErpnextSalesOrderDetail(input.sales_order_name);
  const today = getTodayDate();
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesInvoice>>(
    "/api/resource/Sales%20Invoice",
    {
      method: "POST",
      body: JSON.stringify({
        customer: salesOrder.customer,
        company: salesOrder.company,
        posting_date: today,
        due_date: today,
        items: (salesOrder.items ?? []).map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          warehouse: item.warehouse,
          sales_order: salesOrder.name,
          so_detail: item.name,
        })),
      }),
    }
  );

  return response.data;
}
