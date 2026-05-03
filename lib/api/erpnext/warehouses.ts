import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateErpnextWarehouseInput,
  ErpnextCreateResponse,
  ErpnextDeleteResponse,
  ErpnextListResponse,
  ErpnextWarehouse,
} from "@/types/erpnext";

const warehouseFields = [
  "name",
  "warehouse_name",
  "company",
  "disabled",
  "is_group",
];

export async function getErpnextWarehouses(): Promise<ErpnextWarehouse[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(warehouseFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextWarehouse>>(
    `/api/resource/Warehouse?${params.toString()}`
  );

  return response.data;
}

export async function createErpnextWarehouse(
  input: CreateErpnextWarehouseInput
): Promise<ErpnextWarehouse> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextWarehouse>>(
    "/api/resource/Warehouse",
    {
      method: "POST",
      body: JSON.stringify({
        warehouse_name: input.warehouse_name,
        company: input.company,
        parent_warehouse: input.parent_warehouse,
        is_group: 0,
      }),
    }
  );

  return response.data;
}

export async function updateErpnextWarehouse(
  name: string,
  input: Partial<CreateErpnextWarehouseInput> & { disabled?: boolean }
): Promise<ErpnextWarehouse> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextWarehouse>>(
    `/api/resource/Warehouse/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        warehouse_name: input.warehouse_name,
        company: input.company,
        parent_warehouse: input.parent_warehouse,
        disabled:
          typeof input.disabled === "boolean"
            ? input.disabled
              ? 1
              : 0
            : undefined,
      }),
    }
  );

  return response.data;
}

export async function deleteErpnextWarehouse(name: string): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>(
    `/api/resource/Warehouse/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    }
  );
}

export async function disableErpnextWarehouse(
  name: string
): Promise<ErpnextWarehouse> {
  return updateErpnextWarehouse(name, { disabled: true });
}

export async function getErpnextWarehouseDetail(
  name: string
): Promise<ErpnextWarehouse> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextWarehouse>>(
    `/api/resource/Warehouse/${encodeURIComponent(name)}`
  );

  return response.data;
}
