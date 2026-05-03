import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateSalesOrderInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextSalesOrder,
} from "@/types/erpnext";

const salesOrderFields = [
  "name",
  "customer",
  "customer_name",
  "transaction_date",
  "delivery_date",
  "status",
  "docstatus",
  "grand_total",
  "net_total",
  "company",
];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function getErpnextSalesOrders(): Promise<ErpnextSalesOrder[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(salesOrderFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextSalesOrder>>(
    `/api/resource/Sales%20Order?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextSalesOrderDetail(
  name: string
): Promise<ErpnextSalesOrder> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesOrder>>(
    `/api/resource/Sales%20Order/${encodeURIComponent(name)}`
  );

  return response.data;
}

export async function createErpnextSalesOrder(
  input: CreateSalesOrderInput
): Promise<ErpnextSalesOrder> {
  const today = getTodayDate();
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSalesOrder>>(
    "/api/resource/Sales%20Order",
    {
      method: "POST",
      body: JSON.stringify({
        customer: input.customer,
        company: input.company,
        transaction_date: today,
        delivery_date: today,
        notes: input.note,
        items: input.items.map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          warehouse: item.warehouse ?? input.warehouse,
        })),
      }),
    }
  );

  return response.data;
}
