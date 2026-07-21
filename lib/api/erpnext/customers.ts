import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateErpnextCustomerInput,
  ErpnextCreateResponse,
  ErpnextCustomer,
  ErpnextDeleteResponse,
  ErpnextListResponse,
} from "@/types/erpnext";

const customerFields = [
  "name",
  "customer_name",
  "customer_type",
  "territory",
  "tax_id",
  "email_id",
  "mobile_no",
  "disabled",
];

export async function getErpnextCustomers(): Promise<ErpnextCustomer[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(customerFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextCustomer>>(
    `/api/resource/Customer?${params.toString()}`
  );

  return response.data;
}

export async function updateErpnextCustomer(
  name: string,
  input: CreateErpnextCustomerInput
): Promise<ErpnextCustomer> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextCustomer>>(
    `/api/resource/Customer/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customer_name: input.customer_name,
        customer_type: input.customer_type ?? "Individual",
        territory: input.territory,
        tax_id: input.tax_id ?? undefined,
        email_id: input.email_id ?? undefined,
        mobile_no: input.mobile_no ?? undefined,
      }),
    }
  );

  return response.data;
}

export async function deleteErpnextCustomer(name: string): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>(
    `/api/resource/Customer/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    }
  );
}

export async function disableErpnextCustomer(
  name: string
): Promise<ErpnextCustomer> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextCustomer>>(
    `/api/resource/Customer/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        disabled: 1,
      }),
    }
  );

  return response.data;
}

export async function createErpnextCustomer(
  input: CreateErpnextCustomerInput
): Promise<ErpnextCustomer> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextCustomer>>(
    "/api/resource/Customer",
    {
      method: "POST",
      body: JSON.stringify({
        customer_name: input.customer_name,
        customer_type: input.customer_type ?? "Individual",
        territory: input.territory,
        tax_id: input.tax_id ?? undefined,
        email_id: input.email_id ?? undefined,
        mobile_no: input.mobile_no ?? undefined,
      }),
    }
  );

  return response.data;
}

export async function createErpnextCustomerAddress(
  customerName: string,
  addressLine1: string
): Promise<void> {
  await erpnextFetch("/api/resource/Address", {
    method: "POST",
    body: JSON.stringify({
      address_title: customerName,
      address_type: "Billing",
      address_line1: addressLine1,
      country: "Ecuador",
      links: [{ link_doctype: "Customer", link_name: customerName }],
    }),
  });
}
