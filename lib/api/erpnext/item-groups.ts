import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  CreateErpnextItemGroupInput,
  ErpnextCreateResponse,
  ErpnextDeleteResponse,
  ErpnextItemGroup,
  ErpnextListResponse,
  UpdateErpnextItemGroupInput,
} from "@/types/erpnext";

const itemGroupFields = [
  "name",
  "item_group_name",
  "parent_item_group",
  "is_group",
  "disabled",
];

export async function getErpnextItemGroups(
  options: { onlyUsable?: boolean } = {}
): Promise<ErpnextItemGroup[]> {
  const params = new URLSearchParams({
    fields: JSON.stringify(itemGroupFields),
    limit_page_length: "500",
    order_by: "name asc",
  });

  const response = await erpnextFetch<ErpnextListResponse<ErpnextItemGroup>>(
    `/api/resource/Item%20Group?${params.toString()}`
  );

  if (!options.onlyUsable) return response.data;

  const usableItemGroups = response.data.filter(
    (itemGroup) => itemGroup.is_group !== 1 && itemGroup.disabled !== 1
  );

  return usableItemGroups.length > 0 ? usableItemGroups : response.data;
}

export async function createErpnextItemGroup(
  input: CreateErpnextItemGroupInput
): Promise<ErpnextItemGroup> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextItemGroup>>(
    "/api/resource/Item%20Group",
    {
      method: "POST",
      body: JSON.stringify({
        item_group_name: input.item_group_name,
        parent_item_group: input.parent_item_group || undefined,
        is_group: input.is_group ? 1 : 0,
      }),
    }
  );

  return response.data;
}

export async function updateErpnextItemGroup(
  name: string,
  input: UpdateErpnextItemGroupInput
): Promise<ErpnextItemGroup> {
  const response = await erpnextFetch<ErpnextCreateResponse<ErpnextItemGroup>>(
    `/api/resource/Item%20Group/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        item_group_name: input.item_group_name,
        parent_item_group: input.parent_item_group || undefined,
        is_group: input.is_group ? 1 : 0,
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

export async function deleteErpnextItemGroup(name: string): Promise<void> {
  await erpnextFetch<ErpnextDeleteResponse>(
    `/api/resource/Item%20Group/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}
