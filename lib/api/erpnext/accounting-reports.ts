import "@/lib/security/server-only";

import { getErpnextAccounts } from "./accounts";
import { getErpnextGlEntries } from "./accounting";
import type { ErpnextAccount, ErpnextGlEntry } from "@/types/erpnext";

export type AccountingReportRange = {
  from?: string;
  to?: string;
  company?: string;
};

export type AccountMovementRow = {
  account: string;
  account_name?: string;
  root_type?: string;
  account_type?: string;
  debit: number;
  credit: number;
  balance: number;
};

export type ProfitAndLossReport = {
  rows: AccountMovementRow[];
  income: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  otherIncome: number;
  otherExpenses: number;
  netProfit: number;
};

export type BalanceSheetReport = {
  rows: AccountMovementRow[];
  assets: AccountMovementRow[];
  liabilities: AccountMovementRow[];
  equity: AccountMovementRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  difference: number;
};

export type TrialBalanceReport = {
  rows: AccountMovementRow[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
};

function getNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildAccountMap(accounts: ErpnextAccount[]) {
  return new Map(accounts.map((account) => [account.name, account]));
}

function buildMovementRows(
  entries: ErpnextGlEntry[],
  accounts: ErpnextAccount[]
): AccountMovementRow[] {
  const accountMap = buildAccountMap(accounts);
  const rows = new Map<string, AccountMovementRow>();

  for (const entry of entries) {
    if (!entry.account || entry.is_cancelled === 1) continue;
    const account = accountMap.get(entry.account);
    const current = rows.get(entry.account) ?? {
      account: entry.account,
      account_name: account?.account_name,
      root_type: account?.root_type,
      account_type: account?.account_type,
      debit: 0,
      credit: 0,
      balance: 0,
    };

    current.debit += getNumber(entry.debit);
    current.credit += getNumber(entry.credit);
    current.balance = current.debit - current.credit;
    rows.set(entry.account, current);
  }

  return Array.from(rows.values()).sort((left, right) =>
    left.account.localeCompare(right.account)
  );
}

function isCostOfSales(row: AccountMovementRow) {
  const text = `${row.account} ${row.account_type ?? ""}`.toLowerCase();
  return (
    text.includes("cost of goods") ||
    text.includes("cogs") ||
    text.includes("cost of sales") ||
    text.includes("costo")
  );
}

export async function buildTrialBalanceReport(
  range: AccountingReportRange
): Promise<TrialBalanceReport> {
  const [accounts, entries] = await Promise.all([
    getErpnextAccounts(range.company).catch(() => []),
    getErpnextGlEntries(range.company, 500, range).catch(() => []),
  ]);
  const rows = buildMovementRows(entries, accounts);
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

  return {
    rows,
    totalDebit,
    totalCredit,
    difference: totalDebit - totalCredit,
  };
}

export async function buildProfitAndLossReport(
  range: AccountingReportRange
): Promise<ProfitAndLossReport> {
  const trialBalance = await buildTrialBalanceReport(range);
  const rows = trialBalance.rows.filter(
    (row) => row.root_type === "Income" || row.root_type === "Expense"
  );
  const incomeRows = rows.filter((row) => row.root_type === "Income");
  const expenseRows = rows.filter((row) => row.root_type === "Expense");
  const costRows = expenseRows.filter(isCostOfSales);
  const operatingRows = expenseRows.filter((row) => !isCostOfSales(row));
  const income = incomeRows.reduce((sum, row) => sum + (row.credit - row.debit), 0);
  const costOfSales = costRows.reduce((sum, row) => sum + row.balance, 0);
  const operatingExpenses = operatingRows.reduce(
    (sum, row) => sum + row.balance,
    0
  );

  return {
    rows,
    income,
    costOfSales,
    grossProfit: income - costOfSales,
    operatingExpenses,
    otherIncome: 0,
    otherExpenses: 0,
    netProfit: income - costOfSales - operatingExpenses,
  };
}

export async function buildBalanceSheetReport(
  range: AccountingReportRange
): Promise<BalanceSheetReport> {
  const trialBalance = await buildTrialBalanceReport(range);
  const rows = trialBalance.rows.filter((row) =>
    ["Asset", "Liability", "Equity"].includes(row.root_type ?? "")
  );
  const assets = rows.filter((row) => row.root_type === "Asset");
  const liabilities = rows.filter((row) => row.root_type === "Liability");
  const equity = rows.filter((row) => row.root_type === "Equity");
  const totalAssets = assets.reduce((sum, row) => sum + row.balance, 0);
  const totalLiabilities = liabilities.reduce(
    (sum, row) => sum + (row.credit - row.debit),
    0
  );
  const totalEquity = equity.reduce((sum, row) => sum + (row.credit - row.debit), 0);

  return {
    rows,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    difference: totalAssets - totalLiabilities - totalEquity,
  };
}
