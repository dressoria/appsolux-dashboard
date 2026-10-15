import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

type LedgerFilter = {
  accountId: string;
  dateFrom: Date;
  dateTo: Date;
};

export type LedgerRow = {
  entryId: string;
  entryNumber: string;
  date: Date;
  description: string;
  lineDescription: string | null;
  debit: Decimal;
  credit: Decimal;
  balance: Decimal;
};

export async function getGeneralLedger(
  tenantId: string,
  filter: LedgerFilter,
): Promise<LedgerRow[]> {
  const prisma = getPrismaClient();

  const lines = await prisma.accountingJournalLine.findMany({
    where: {
      tenantId,
      accountId: filter.accountId,
      entry: {
        status: "POSTED",
        date: { gte: filter.dateFrom, lte: filter.dateTo },
      },
    },
    include: {
      entry: { select: { id: true, number: true, date: true, description: true } },
    },
    orderBy: { entry: { date: "asc" } },
  });

  const account = await prisma.accountingAccount.findFirst({
    where: { id: filter.accountId, tenantId },
    select: { normalBalance: true },
  });

  let balance = new Decimal(0);
  return lines.map((line) => {
    if (account?.normalBalance === "DEBIT") {
      balance = balance.plus(line.debit).minus(line.credit);
    } else {
      balance = balance.plus(line.credit).minus(line.debit);
    }
    return {
      entryId: line.entry.id,
      entryNumber: line.entry.number,
      date: line.entry.date,
      description: line.entry.description,
      lineDescription: line.description,
      debit: line.debit,
      credit: line.credit,
      balance,
    };
  });
}

type ReportFilter = {
  dateFrom: Date;
  dateTo: Date;
  planId: string;
};

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  rootType: string;
  level: number;
  isGroup: boolean;
  debitTotal: Decimal;
  creditTotal: Decimal;
  debitBalance: Decimal;
  creditBalance: Decimal;
};

export async function getTrialBalance(
  tenantId: string,
  filter: ReportFilter,
): Promise<TrialBalanceRow[]> {
  const prisma = getPrismaClient();

  const accounts = await prisma.accountingAccount.findMany({
    where: { tenantId, planId: filter.planId, active: true },
    orderBy: { code: "asc" },
  });

  const lines = await prisma.accountingJournalLine.findMany({
    where: {
      tenantId,
      entry: {
        status: "POSTED",
        date: { gte: filter.dateFrom, lte: filter.dateTo },
      },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const accountTotals = new Map<string, { debit: Decimal; credit: Decimal }>();
  for (const line of lines) {
    const current = accountTotals.get(line.accountId) ?? {
      debit: new Decimal(0),
      credit: new Decimal(0),
    };
    current.debit = current.debit.plus(line.debit);
    current.credit = current.credit.plus(line.credit);
    accountTotals.set(line.accountId, current);
  }

  return accounts.map((account) => {
    const totals = accountTotals.get(account.id) ?? {
      debit: new Decimal(0),
      credit: new Decimal(0),
    };

    const net = totals.debit.minus(totals.credit);
    const debitBalance = net.greaterThan(0) ? net : new Decimal(0);
    const creditBalance = net.lessThan(0) ? net.abs() : new Decimal(0);

    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      rootType: account.rootType,
      level: account.level,
      isGroup: account.isGroup,
      debitTotal: totals.debit,
      creditTotal: totals.credit,
      debitBalance,
      creditBalance,
    };
  }).filter((row) => !row.debitTotal.isZero() || !row.creditTotal.isZero());
}

export type FinancialStatementRow = {
  accountId: string;
  code: string;
  name: string;
  level: number;
  isGroup: boolean;
  balance: Decimal;
};

export async function getIncomeStatement(
  tenantId: string,
  filter: ReportFilter,
): Promise<{ rows: FinancialStatementRow[]; netIncome: Decimal }> {
  const prisma = getPrismaClient();

  const accounts = await prisma.accountingAccount.findMany({
    where: {
      tenantId,
      planId: filter.planId,
      active: true,
      rootType: { in: ["INCOME", "COST_EXPENSE"] },
    },
    orderBy: { code: "asc" },
  });

  const lines = await prisma.accountingJournalLine.findMany({
    where: {
      tenantId,
      accountId: { in: accounts.map((a) => a.id) },
      entry: {
        status: "POSTED",
        date: { gte: filter.dateFrom, lte: filter.dateTo },
      },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const accountTotals = new Map<string, Decimal>();
  for (const line of lines) {
    const account = accounts.find((a) => a.id === line.accountId);
    if (!account) continue;
    const current = accountTotals.get(line.accountId) ?? new Decimal(0);
    if (account.normalBalance === "CREDIT") {
      accountTotals.set(line.accountId, current.plus(line.credit).minus(line.debit));
    } else {
      accountTotals.set(line.accountId, current.plus(line.debit).minus(line.credit));
    }
  }

  let netIncome = new Decimal(0);
  const rows: FinancialStatementRow[] = [];
  for (const account of accounts) {
    const balance = accountTotals.get(account.id) ?? new Decimal(0);
    if (balance.isZero()) continue;
    rows.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      level: account.level,
      isGroup: account.isGroup,
      balance,
    });
    if (account.rootType === "INCOME") {
      netIncome = netIncome.plus(balance);
    } else {
      netIncome = netIncome.minus(balance);
    }
  }

  return { rows, netIncome };
}

export async function getBalanceSheet(
  tenantId: string,
  filter: ReportFilter,
): Promise<{
  rows: FinancialStatementRow[];
  totalAssets: Decimal;
  totalLiabilities: Decimal;
  totalEquity: Decimal;
}> {
  const prisma = getPrismaClient();

  const accounts = await prisma.accountingAccount.findMany({
    where: {
      tenantId,
      planId: filter.planId,
      active: true,
      rootType: { in: ["ASSET", "LIABILITY", "EQUITY"] },
    },
    orderBy: { code: "asc" },
  });

  const lines = await prisma.accountingJournalLine.findMany({
    where: {
      tenantId,
      accountId: { in: accounts.map((a) => a.id) },
      entry: {
        status: "POSTED",
        date: { lte: filter.dateTo },
      },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const accountTotals = new Map<string, Decimal>();
  for (const line of lines) {
    const account = accounts.find((a) => a.id === line.accountId);
    if (!account) continue;
    const current = accountTotals.get(line.accountId) ?? new Decimal(0);
    if (account.normalBalance === "DEBIT") {
      accountTotals.set(line.accountId, current.plus(line.debit).minus(line.credit));
    } else {
      accountTotals.set(line.accountId, current.plus(line.credit).minus(line.debit));
    }
  }

  let totalAssets = new Decimal(0);
  let totalLiabilities = new Decimal(0);
  let totalEquity = new Decimal(0);
  const rows: FinancialStatementRow[] = [];

  for (const account of accounts) {
    const balance = accountTotals.get(account.id) ?? new Decimal(0);
    if (balance.isZero()) continue;
    rows.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      level: account.level,
      isGroup: account.isGroup,
      balance,
    });
    if (account.rootType === "ASSET") totalAssets = totalAssets.plus(balance);
    else if (account.rootType === "LIABILITY") totalLiabilities = totalLiabilities.plus(balance);
    else totalEquity = totalEquity.plus(balance);
  }

  return { rows, totalAssets, totalLiabilities, totalEquity };
}
