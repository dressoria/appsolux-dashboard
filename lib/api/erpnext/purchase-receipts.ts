import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreatePurchaseReceiptInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextPurchaseReceipt,
} from "@/types/erpnext";

const purchaseReceiptFields = [
  "name",
  "supplier",
  "supplier_name",
  "posting_date",
  "status",
  "docstatus",
  "grand_total",
  "company",
];

export async function getErpnextPurchaseReceipts(): Promise<ErpnextPurchaseReceipt[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(purchaseReceiptFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextPurchaseReceipt>>(
    `/api/resource/Purchase%20Receipt?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextPurchaseReceiptDetail(
  name: string
): Promise<ErpnextPurchaseReceipt> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPurchaseReceipt>>(
    `/api/resource/Purchase%20Receipt/${encodeURIComponent(name)}`
  );

  return response.data;
}

export async function createErpnextPurchaseReceipt(
  input: CreatePurchaseReceiptInput
): Promise<ErpnextPurchaseReceipt> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPurchaseReceipt>>(
    "/api/resource/Purchase%20Receipt",
    {
      method: "POST",
      body: JSON.stringify({
        doctype: "Purchase Receipt",
        supplier: input.supplier,
        company: input.company,
        posting_date: input.posting_date,
        items: input.items.map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          warehouse: item.warehouse,
          ...(item.rate !== undefined ? { rate: item.rate } : {}),
        })),
      }),
    }
  );

  return response.data;
}
