import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreatePurchaseInvoiceInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextPurchaseInvoice,
} from "@/types/erpnext";

const purchaseInvoiceFields = [
  "name",
  "supplier",
  "supplier_name",
  "posting_date",
  "due_date",
  "bill_date",
  "bill_no",
  "grand_total",
  "outstanding_amount",
  "paid_amount",
  "status",
  "docstatus",
  "company",
];

export async function getErpnextPurchaseInvoices(): Promise<ErpnextPurchaseInvoice[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(purchaseInvoiceFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextPurchaseInvoice>>(
    `/api/resource/Purchase%20Invoice?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextPurchaseInvoiceDetail(
  name: string
): Promise<ErpnextPurchaseInvoice> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPurchaseInvoice>>(
    `/api/resource/Purchase%20Invoice/${encodeURIComponent(name)}`
  );

  return response.data;
}

export async function createErpnextPurchaseInvoice(
  input: CreatePurchaseInvoiceInput
): Promise<ErpnextPurchaseInvoice> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextPurchaseInvoice>>(
    "/api/resource/Purchase%20Invoice",
    {
      method: "POST",
      body: JSON.stringify({
        doctype: "Purchase Invoice",
        supplier: input.supplier,
        company: input.company,
        posting_date: input.posting_date,
        bill_date: input.bill_date ?? input.posting_date,
        ...(input.bill_no ? { bill_no: input.bill_no } : {}),
        items: input.items.map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          ...(item.warehouse ? { warehouse: item.warehouse } : {}),
        })),
      }),
    }
  );

  return response.data;
}
