import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextCreateResponse,
  ErpnextListResponse,
  ErpnextSupplier,
} from "@/types/erpnext";

const supplierFields = [
  "name",
  "supplier_name",
  "supplier_type",
  "tax_id",
  "email_id",
  "mobile_no",
  "disabled",
];

export async function getErpnextSuppliers(): Promise<ErpnextSupplier[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(supplierFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextSupplier>>(
    `/api/resource/Supplier?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextSupplierDetail(
  name: string
): Promise<ErpnextSupplier> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSupplier>>(
    `/api/resource/Supplier/${encodeURIComponent(name)}`
  );

  return response.data;
}
