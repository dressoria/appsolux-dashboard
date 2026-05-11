import "@/lib/security/server-only";
import { erpnextFetch } from "./client";
import type {
  ErpnextListResponse,
  ErpnextStockLedgerEntry,
} from "@/types/erpnext";

const stockLedgerFields = [
  "name",
  "posting_date",
  "posting_time",
  "item_code",
  "warehouse",
  "actual_qty",
  "qty_after_transaction",
  "valuation_rate",
  "stock_value_difference",
  "voucher_type",
  "voucher_no",
];

export type GetStockLedgerInput = {
  item_code?: string;
  warehouse?: string;
};

export async function getErpnextStockLedger(
  input: GetStockLedgerInput = {}
): Promise<ErpnextStockLedgerEntry[]> {
  const filters: string[][] = [];

  if (input.item_code) {
    filters.push(["item_code", "=", input.item_code]);
  }

  if (input.warehouse) {
    filters.push(["warehouse", "=", input.warehouse]);
  }

  const params = new URLSearchParams({
    fields: JSON.stringify(stockLedgerFields),
    limit_page_length: "100",
    order_by: "posting_date desc, posting_time desc",
  });

  if (filters.length > 0) {
    params.set("filters", JSON.stringify(filters));
  }

  const response = await erpnextFetch<
    ErpnextListResponse<ErpnextStockLedgerEntry>
  >(`/api/resource/Stock%20Ledger%20Entry?${params.toString()}`);

  return response.data;
}
