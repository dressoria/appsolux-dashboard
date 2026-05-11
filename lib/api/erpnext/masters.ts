import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import { getErpnextCompanies } from "./companies";
import { getErpnextItemGroups } from "./item-groups";
import { getErpnextUoms } from "./uoms";
import type {
  ErpnextListResponse,
  ErpnextMasters,
  ErpnextTerritory,
} from "@/types/erpnext";

function getListPath(doctype: string, fields: string[]) {
  const params = new URLSearchParams({
    fields: JSON.stringify(fields),
    limit_page_length: "500",
    order_by: "name asc",
  });

  return `/api/resource/${encodeURIComponent(doctype)}?${params.toString()}`;
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
    getErpnextItemGroups({ onlyUsable: true }),
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
