import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateErpnextWarehouseInput,
  ErpnextCreateResponse,
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
      }),
    }
  );

  return response.data;
}
