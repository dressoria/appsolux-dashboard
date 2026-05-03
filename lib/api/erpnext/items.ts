import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateErpnextItemInput,
  ErpnextCreateResponse,
  ErpnextDeleteResponse,
  ErpnextItem,
  ErpnextListResponse,
} from "@/types/erpnext";

const itemFields = [
  "name",
  "item_name",
  "item_code",
  "item_group",
  "stock_uom",
  "disabled",
  "is_stock_item",
];

export async function getErpnextItems(): Promise<ErpnextItem[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(itemFields),
    limit_page_length: "100",
    order_by: "modified desc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextItem>>(
    `/api/resource/Item?${params.toString()}`
  );

  return response.data;
}

export async function createErpnextItem(
  input: CreateErpnextItemInput
): Promise<ErpnextItem> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextItem>>(
    "/api/resource/Item",
    {
      method: "POST",
      body: JSON.stringify({
        item_code: input.item_code,
        item_name: input.item_name,
        stock_uom: input.stock_uom,
        item_group: input.item_group,
        is_stock_item: input.is_stock_item === false ? 0 : 1,
      }),
    }
  );

  return response.data;
}

export async function updateErpnextItem(
  name: string,
  input: Partial<CreateErpnextItemInput>
): Promise<ErpnextItem> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextItem>>(
    `/api/resource/Item/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        item_name: input.item_name,
        stock_uom: input.stock_uom,
        item_group: input.item_group,
        is_stock_item:
          typeof input.is_stock_item === "boolean"
            ? input.is_stock_item
              ? 1
              : 0
            : undefined,
      }),
    }
  );

  return response.data;
}

export async function deleteErpnextItem(name: string): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>(
    `/api/resource/Item/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    }
  );
}

export async function disableErpnextItem(name: string): Promise<ErpnextItem> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextItem>>(
    `/api/resource/Item/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        disabled: 1,
      }),
    }
  );

  return response.data;
}
