import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getClosingPreview(tenantId: string, year: number) {
  const prisma = getPrismaClient();

  const period = await prisma.accountingPeriod.findFirst({
    where: { tenantId, year, month: null },
  });
  if (period?.status === "LOCKED") {
    throw new Error(`El período ${year} ya está cerrado y bloqueado`);
  }

  const dateFrom = new Date(year, 0, 1);
  const dateTo = new Date(year, 11, 31, 23, 59, 59, 999);

  const incomeExpenseAccounts = await prisma.accountingAccount.findMany({
    where: {
      tenantId,
      active: true,
      rootType: { in: ["INCOME", "COST_EXPENSE"] },
    },
    select: { id: true, code: true, name: true, rootType: true, normalBalance: true },
  });

  const lines = await prisma.accountingJournalLine.findMany({
    where: {
      tenantId,
      accountId: { in: incomeExpenseAccounts.map((a) => a.id) },
      entry: {
        status: "POSTED",
        date: { gte: dateFrom, lte: dateTo },
      },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const balances = new Map<string, Decimal>();
  for (const line of lines) {
    const account = incomeExpenseAccounts.find((a) => a.id === line.accountId);
    if (!account) continue;
    const current = balances.get(line.accountId) ?? new Decimal(0);
    if (account.normalBalance === "CREDIT") {
      balances.set(line.accountId, current.plus(line.credit).minus(line.debit));
    } else {
      balances.set(line.accountId, current.plus(line.debit).minus(line.credit));
    }
  }

  let totalIncome = new Decimal(0);
  let totalExpense = new Decimal(0);
  const closingLines: Array<{
    accountId: string;
    code: string;
    name: string;
    rootType: string;
    balance: Decimal;
  }> = [];

  for (const account of incomeExpenseAccounts) {
    const balance = balances.get(account.id);
    if (!balance || balance.isZero()) continue;
    closingLines.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      rootType: account.rootType,
      balance,
    });
    if (account.rootType === "INCOME") {
      totalIncome = totalIncome.plus(balance);
    } else {
      totalExpense = totalExpense.plus(balance);
    }
  }

  const netResult = totalIncome.minus(totalExpense);

  return {
    year,
    totalIncome,
    totalExpense,
    netResult,
    closingLines,
    alreadyClosed: period?.status === "CLOSED",
  };
}

export async function executeClosing(
  tenantId: string,
  year: number,
  closedByUserId: string,
) {
  const prisma = getPrismaClient();

  const existing = await prisma.accountingJournalEntry.findFirst({
    where: {
      tenantId,
      sourceType: "CLOSING",
      sourceId: `closing-${year}`,
    },
  });
  if (existing) {
    return { entry: existing, alreadyExisted: true };
  }

  const preview = await getClosingPreview(tenantId, year);

  const closingProfitLossMapping = await prisma.accountingAccountMapping.findUnique({
    where: { tenantId_key: { tenantId, key: "CLOSING_PROFIT_LOSS" } },
  });
  if (!closingProfitLossMapping) {
    throw new Error("Falta configurar la cuenta de Utilidad/Pérdida del ejercicio en Parámetros");
  }

  const journalLines: Array<{
    accountId: string;
    debit: Decimal;
    credit: Decimal;
    description: string;
  }> = [];

  for (const line of preview.closingLines) {
    const account = await prisma.accountingAccount.findFirst({
      where: { id: line.accountId, tenantId },
      select: { normalBalance: true },
    });
    if (!account) continue;

    if (account.normalBalance === "CREDIT") {
      journalLines.push({
        accountId: line.accountId,
        debit: line.balance,
        credit: new Decimal(0),
        description: `Cierre ${year}: ${line.name}`,
      });
    } else {
      journalLines.push({
        accountId: line.accountId,
        debit: new Decimal(0),
        credit: line.balance,
        description: `Cierre ${year}: ${line.name}`,
      });
    }
  }

  if (preview.netResult.greaterThan(0)) {
    journalLines.push({
      accountId: closingProfitLossMapping.accountId,
      debit: new Decimal(0),
      credit: preview.netResult,
      description: `Utilidad del ejercicio ${year}`,
    });
  } else if (preview.netResult.lessThan(0)) {
    journalLines.push({
      accountId: closingProfitLossMapping.accountId,
      debit: preview.netResult.abs(),
      credit: new Decimal(0),
      description: `Pérdida del ejercicio ${year}`,
    });
  }

  const closingDate = new Date(year, 11, 31);

  return prisma.$transaction(async (tx) => {
    const last = await tx.accountingJournalEntry.findFirst({
      where: { tenantId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let seq = 1;
    if (last) {
      const parts = last.number.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) seq = num + 1;
    }
    const number = `ASICOM-${String(seq).padStart(9, "0")}`;

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    for (const jl of journalLines) {
      totalDebit = totalDebit.plus(jl.debit);
      totalCredit = totalCredit.plus(jl.credit);
    }

    const entry = await tx.accountingJournalEntry.create({
      data: {
        tenantId,
        number,
        date: closingDate,
        description: `Asiento de cierre del ejercicio ${year}`,
        sourceType: "CLOSING",
        sourceId: `closing-${year}`,
        status: "POSTED",
        totalDebit,
        totalCredit,
        createdByUserId: closedByUserId,
        postedByUserId: closedByUserId,
        postedAt: new Date(),
      },
    });

    await tx.accountingJournalLine.createMany({
      data: journalLines.map((jl) => ({
        tenantId,
        entryId: entry.id,
        accountId: jl.accountId,
        description: jl.description,
        debit: jl.debit,
        credit: jl.credit,
      })),
    });

    await tx.accountingPeriod.upsert({
      where: { tenantId_year_month: { tenantId, year, month: 0 } },
      create: {
        tenantId,
        year,
        month: 0,
        startDate: new Date(year, 0, 1),
        endDate: closingDate,
        status: "CLOSED",
        closedAt: new Date(),
        closedByUserId,
      },
      update: {
        status: "CLOSED",
        closedAt: new Date(),
        closedByUserId,
      },
    });

    return { entry, alreadyExisted: false };
  });
}
