import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateStockEntryInput,
  ErpnextCreateResponse,
  ErpnextStockEntry,
} from "@/types/erpnext";

export async function createErpnextStockEntry(
  input: CreateStockEntryInput
): Promise<ErpnextStockEntry> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextStockEntry>>(
    "/api/resource/Stock%20Entry",
    {
      method: "POST",
      body: JSON.stringify({
        stock_entry_type: "Material Receipt",
        purpose: "Material Receipt",
        items: [
          {
            item_code: input.item_code,
            t_warehouse: input.warehouse,
            qty: input.qty,
            basic_rate: input.basic_rate ?? 0,
          },
        ],
      }),
    }
  );

  return response.data;
}
