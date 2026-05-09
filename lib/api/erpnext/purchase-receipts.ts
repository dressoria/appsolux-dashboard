import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
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
