import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { getErpnextCompanies } from "./companies";
import type {
  ErpnextItemGroup,
  ErpnextListResponse,
  ErpnextMasters,
  ErpnextTerritory,
  ErpnextUom,
} from "@/types/erpnext";

function getListPath(doctype: string, fields: string[]) {
  const params = new URLSearchParams({
    fields: JSON.stringify(fields),
    limit_page_length: "500",
    order_by: "name asc",
  });

  return `/api/resource/${encodeURIComponent(doctype)}?${params.toString()}`;
}

export async function getErpnextItemGroups(): Promise<ErpnextItemGroup[]> {
  const response = await erpnextFetch<ErpnextListResponse<ErpnextItemGroup>>(
    getListPath("Item Group", ["name", "item_group_name", "is_group"])
  );

  const usableItemGroups = response.data.filter(
    (itemGroup) => itemGroup.is_group !== 1
  );

  return usableItemGroups.length > 0 ? usableItemGroups : response.data;
}

export async function getErpnextUoms(): Promise<ErpnextUom[]> {
  const response = await erpnextFetch<ErpnextListResponse<ErpnextUom>>(
    getListPath("UOM", ["name", "uom_name"])
  );

  return response.data;
}

export async function getErpnextTerritories(): Promise<ErpnextTerritory[]> {
  const response = await erpnextFetch<ErpnextListResponse<ErpnextTerritory>>(
    getListPath("Territory", ["name", "territory_name", "is_group"])
  );

  const usableTerritories = response.data.filter(
    (territory) => territory.is_group !== 1
  );

  return usableTerritories.length > 0 ? usableTerritories : response.data;
}

export async function getErpnextMasters(): Promise<ErpnextMasters> {
  const [itemGroups, uoms, territories, companies] = await Promise.all([
    getErpnextItemGroups(),
    getErpnextUoms(),
    getErpnextTerritories(),
    getErpnextCompanies(),
  ]);

  return {
    itemGroups,
    uoms,
    territories,
    companies,
  };
}
