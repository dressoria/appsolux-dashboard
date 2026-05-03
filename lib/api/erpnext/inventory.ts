import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type { ErpnextBin, ErpnextListResponse } from "@/types/erpnext";

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
