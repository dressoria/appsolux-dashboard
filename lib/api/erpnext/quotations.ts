import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateQuotationInput,
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextQuotation,
} from "@/types/erpnext";

const quotationFields = [
  "name",
  "quotation_to",
  "party_name",
  "customer_name",
  "transaction_date",
  "valid_till",
  "status",
  "docstatus",
  "grand_total",
  "net_total",
  "currency",
  "company",
];

export async function getErpnextQuotations(): Promise<ErpnextQuotation[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(quotationFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextQuotation>>(
    `/api/resource/Quotation?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextQuotationDetail(
  name: string
): Promise<ErpnextQuotation> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextQuotation>>(
    `/api/resource/Quotation/${encodeURIComponent(name)}`
  );

  return response.data;
}

export async function createErpnextQuotation(
  input: CreateQuotationInput
): Promise<ErpnextQuotation> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextQuotation>>(
    "/api/resource/Quotation",
    {
      method: "POST",
      body: JSON.stringify({
        quotation_to: "Customer",
        party_name: input.customer,
        company: input.company,
        transaction_date: input.transaction_date,
        valid_till: input.valid_till || undefined,
        order_type: "Sales",
        notes: input.notes || undefined,
        items: input.items.map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          discount_percentage: item.discount_percentage ?? 0,
        })),
      }),
    }
  );

  return response.data;
}
