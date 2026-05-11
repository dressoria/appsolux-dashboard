import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateErpnextSupplierInput,
  ErpnextCreateResponse,
  ErpnextDeleteResponse,
  ErpnextListResponse,
  ErpnextSupplier,
  UpdateErpnextSupplierInput,
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

export async function createErpnextSupplier(
  input: CreateErpnextSupplierInput
): Promise<ErpnextSupplier> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSupplier>>(
    "/api/resource/Supplier",
    {
      method: "POST",
      body: JSON.stringify({
        supplier_name: input.supplier_name,
        supplier_type: input.supplier_type ?? "Company",
        tax_id: input.tax_id ?? undefined,
        mobile_no: input.mobile_no ?? undefined,
        email_id: input.email_id ?? undefined,
      }),
    }
  );

  return response.data;
}

export async function updateErpnextSupplier(
  name: string,
  input: UpdateErpnextSupplierInput
): Promise<ErpnextSupplier> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSupplier>>(
    `/api/resource/Supplier/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        supplier_name: input.supplier_name,
        supplier_type: input.supplier_type ?? "Company",
        tax_id: input.tax_id ?? undefined,
        mobile_no: input.mobile_no ?? undefined,
        email_id: input.email_id ?? undefined,
      }),
    }
  );

  return response.data;
}

export async function disableErpnextSupplier(
  name: string
): Promise<ErpnextSupplier> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextSupplier>>(
    `/api/resource/Supplier/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({ disabled: 1 }),
    }
  );

  return response.data;
}

export async function deleteErpnextSupplier(name: string): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>(
    `/api/resource/Supplier/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}
