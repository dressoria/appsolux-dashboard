import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextBin,
  ErpnextDeleteResponse,
  ErpnextListResponse,
} from "@/types/erpnext";

const binFields = [
  "name",
  "item_code",
  "warehouse",
  "actual_qty",
  "reserved_qty",
  "projected_qty",
];

export async function getErpnextInventory(): Promise<ErpnextBin[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(binFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextBin>>(
    `/api/resource/Bin?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextInventoryBin(
  itemCode: string,
  warehouse: string
): Promise<ErpnextBin | null> {
  const params = new URLSearchParams({
    fields: JSON.stringify(binFields),
    filters: JSON.stringify([
      ["item_code", "=", itemCode],
      ["warehouse", "=", warehouse],
    ]),
    limit_page_length: "1",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextBin>>(
    `/api/resource/Bin?${params.toString()}`
  );

  return response.data[0] ?? null;
}

export async function deleteErpnextInventoryBin(name: string): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>(
    `/api/resource/Bin/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    }
  );
}
