import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreatePurchaseOrderInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextPurchaseOrder,
} from "@/types/erpnext";

const purchaseOrderFields = [
  "name",
  "supplier",
  "supplier_name",
  "transaction_date",
  "schedule_date",
  "status",
  "docstatus",
  "grand_total",
  "net_total",
  "company",
];

export async function getErpnextPurchaseOrders(): Promise<ErpnextPurchaseOrder[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(purchaseOrderFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextPurchaseOrder>>(
    `/api/resource/Purchase%20Order?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextPurchaseOrderDetail(
  name: string
): Promise<ErpnextPurchaseOrder> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPurchaseOrder>>(
    `/api/resource/Purchase%20Order/${encodeURIComponent(name)}`
  );

  return response.data;
}

export async function createErpnextPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<ErpnextPurchaseOrder> {
  const scheduleDate = input.schedule_date ?? input.transaction_date;

  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPurchaseOrder>>(
    "/api/resource/Purchase%20Order",
    {
      method: "POST",
      body: JSON.stringify({
        doctype: "Purchase Order",
        supplier: input.supplier,
        company: input.company,
        transaction_date: input.transaction_date,
        schedule_date: scheduleDate,
        items: input.items.map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          schedule_date: scheduleDate,
          ...(item.warehouse ? { warehouse: item.warehouse } : {}),
        })),
      }),
    }
  );

  return response.data;
}
