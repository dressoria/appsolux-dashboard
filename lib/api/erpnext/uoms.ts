import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateErpnextUomInput,
  ErpnextCreateResponse,
  ErpnextDeleteResponse,
  ErpnextListResponse,
  ErpnextUom,
  UpdateErpnextUomInput,
} from "@/types/erpnext";

const uomFields = ["name", "uom_name", "enabled"];

export async function getErpnextUoms(): Promise<ErpnextUom[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(uomFields),
    limit_page_length: "500",
    order_by: "name asc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextUom>>(
    `/api/resource/UOM?${params.toString()}`
  );

  return response.data;
}

export async function createErpnextUom(
  input: CreateErpnextUomInput
): Promise<ErpnextUom> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextUom>>(
    "/api/resource/UOM",
    {
      method: "POST",
      body: JSON.stringify({
        uom_name: input.uom_name,
        enabled: 1,
      }),
    }
  );

  return response.data;
}

export async function updateErpnextUom(
  name: string,
  input: UpdateErpnextUomInput
): Promise<ErpnextUom> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextUom>>(
    `/api/resource/UOM/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        uom_name: input.uom_name,
        enabled:
          typeof input.enabled === "boolean"
            ? input.enabled
              ? 1
              : 0
            : undefined,
      }),
    }
  );

  return response.data;
}

export async function deleteErpnextUom(name: string): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>(
    `/api/resource/UOM/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}
