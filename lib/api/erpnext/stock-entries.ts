import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateStockEntryInput,
  ErpnextCreateResponse,
  ErpnextMethodResponse,
  ErpnextStockEntry,
} from "@/types/erpnext";

type CreateStockMovementInput = {
  item_code: string;
  warehouse: string;
  qty: number;
  basic_rate?: number;
  movement: "in" | "out";
  remarks?: string;
};

function getStockEntryResourcePath(name: string) {
  return `/api/resource/Stock%20Entry/${encodeURIComponent(name)}`;
}

export async function createErpnextStockEntry(
  input: CreateStockEntryInput
): Promise<ErpnextStockEntry> {
  return createErpnextStockMovement({
    ...input,
    movement: "in",
  });
}

export async function createErpnextStockMovement(
  input: CreateStockMovementInput
): Promise<ErpnextStockEntry> {
  const isIncoming = input.movement === "in";
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextStockEntry>>(
    "/api/resource/Stock%20Entry",
    {
      method: "POST",
      body: JSON.stringify({
        stock_entry_type: isIncoming ? "Material Receipt" : "Material Issue",
        purpose: isIncoming ? "Material Receipt" : "Material Issue",
        remarks: input.remarks,
        items: [
          {
            item_code: input.item_code,
            t_warehouse: isIncoming ? input.warehouse : undefined,
            s_warehouse: isIncoming ? undefined : input.warehouse,
            qty: input.qty,
            basic_rate: input.basic_rate ?? 0,
          },
        ],
      }),
    }
  );

  return response.data;
}

export async function getErpnextStockEntry(
  name: string
): Promise<ErpnextStockEntry> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextStockEntry>>(
    getStockEntryResourcePath(name)
  );

  return response.data;
}

export async function submitErpnextStockEntry(
  stockEntry: ErpnextStockEntry
): Promise<ErpnextStockEntry> {
  const response = await erpnextFetch<ErpnextMethodResponse<ErpnextStockEntry>>(
    "/api/method/frappe.client.submit",
    {
      method: "POST",
      body: JSON.stringify({
        doc: {
          ...stockEntry,
          doctype: "Stock Entry",
        },
      }),
    }
  );

  return response.message;
}

export async function createAndSubmitErpnextStockEntry(
  input: CreateStockEntryInput
): Promise<ErpnextStockEntry> {
  const stockEntry = await createErpnextStockEntry(input);
  const fullStockEntry = await getErpnextStockEntry(stockEntry.name);
  return submitErpnextStockEntry(fullStockEntry);
}
