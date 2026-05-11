import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextCostCenter,
  ErpnextGlEntry,
  ErpnextJournalEntry,
  ErpnextListResponse,
} from "@/types/erpnext";

const glEntryFields = [
  "name",
  "posting_date",
  "account",
  "debit",
  "credit",
  "voucher_type",
  "voucher_no",
  "party_type",
  "party",
  "remarks",
  "company",
  "is_cancelled",
];

const journalEntryFields = [
  "name",
  "title",
  "posting_date",
  "voucher_type",
  "total_debit",
  "total_credit",
  "docstatus",
  "company",
  "user_remark",
];

const costCenterFields = [
  "name",
  "cost_center_name",
  "company",
  "disabled",
  "is_group",
  "parent_cost_center",
];

export async function getErpnextGlEntries(
  company?: string,
  limit = 100,
  options?: { from?: string; to?: string; account?: string }
): Promise<ErpnextGlEntry[]> {
  const filters: unknown[] = company ? [["company", "=", company]] : [];
  if (options?.from) filters.push(["posting_date", ">=", options.from]);
  if (options?.to) filters.push(["posting_date", "<=", options.to]);
  if (options?.account) filters.push(["account", "=", options.account]);
  const params = new URLSearchParams({
    fields: JSON.stringify(glEntryFields),
    limit_page_length: String(limit),
    order_by: "posting_date desc, name desc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<ErpnextListResponse<ErpnextGlEntry>>(
    `/api/resource/GL%20Entry?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextJournalEntries(
  company?: string,
  limit = 50
): Promise<ErpnextJournalEntry[]> {
  const filters: unknown[] = company ? [["company", "=", company]] : [];
  const params = new URLSearchParams({
    fields: JSON.stringify(journalEntryFields),
    limit_page_length: String(limit),
    order_by: "posting_date desc, name desc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<ErpnextListResponse<ErpnextJournalEntry>>(
    `/api/resource/Journal%20Entry?${params.toString()}`
  );

  return response.data;
}

export async function getErpnextCostCenters(
  company?: string
): Promise<ErpnextCostCenter[]> {
  const filters: unknown[] = company ? [["company", "=", company]] : [];
  const params = new URLSearchParams({
    fields: JSON.stringify(costCenterFields),
    limit_page_length: "100",
    order_by: "name asc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<ErpnextListResponse<ErpnextCostCenter>>(
    `/api/resource/Cost%20Center?${params.toString()}`
  );

  return response.data;
}

export async function createErpnextCostCenter(input: {
  cost_center_name: string;
  company: string;
  parent_cost_center?: string;
  is_group?: 0 | 1;
}): Promise<ErpnextCostCenter> {
  const response = await erpnextFetch<{ data: ErpnextCostCenter }>(
    "/api/resource/Cost%20Center",
    {
      method: "POST",
      body: JSON.stringify({
        cost_center_name: input.cost_center_name,
        company: input.company,
        parent_cost_center: input.parent_cost_center || undefined,
        is_group: input.is_group ?? 0,
      }),
    }
  );

  return response.data;
}

export async function updateErpnextCostCenter(
  name: string,
  input: Partial<{
    cost_center_name: string;
    parent_cost_center: string;
    disabled: 0 | 1;
  }>
): Promise<ErpnextCostCenter> {
  const response = await erpnextFetch<{ data: ErpnextCostCenter }>(
    `/api/resource/Cost%20Center/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        cost_center_name: input.cost_center_name || undefined,
        parent_cost_center: input.parent_cost_center || undefined,
        disabled: input.disabled,
      }),
    }
  );

  return response.data;
}

export async function disableErpnextCostCenter(
  name: string
): Promise<ErpnextCostCenter> {
  return updateErpnextCostCenter(name, { disabled: 1 });
}
