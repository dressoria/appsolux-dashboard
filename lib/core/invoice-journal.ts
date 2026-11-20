import "@/lib/security/server-only";
import { Decimal } from "@prisma/client/runtime/library";
import { getPrismaClient } from "@/lib/db/prisma";
import { getJournalEntryById } from "@/lib/core/accounting-journal";
import type { InvoiceJournal } from "@/types/invoice-ui";

/** Read only: SALE/sourceId is the association already used by cancellation. */
export async function getInvoiceJournal(tenantId: string, saleId: string): Promise<InvoiceJournal | null | undefined> {
  const prisma = getPrismaClient();
  const sale = await prisma.lightweightSale.findFirst({ where: { id: saleId, tenantId }, select: { id: true } });
  if (!sale) return undefined;
  const source = await prisma.accountingJournalEntry.findFirst({
    where: { tenantId, sourceType: "SALE", sourceId: sale.id },
    select: { id: true },
  });
  if (!source) return null;
  const entry = await getJournalEntryById(tenantId, source.id);
  if (!entry || !entry.lines.length) return null;

  // Reject inconsistent legacy references instead of exposing another tenant's accounts.
  const accountIds = [...new Set(entry.lines.map((line) => line.accountId))];
  const accounts = await prisma.accountingAccount.findMany({
    where: { tenantId, id: { in: accountIds } }, select: { id: true },
  });
  if (accounts.length !== accountIds.length || entry.lines.some((line) => line.tenantId !== tenantId)) {
    throw new Error("No se puede mostrar un asiento con referencias contables fuera de esta empresa.");
  }
  const totalDebit = entry.lines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0));
  const totalCredit = entry.lines.reduce((sum, line) => sum.plus(line.credit), new Decimal(0));
  return {
    id: entry.id, number: entry.number, status: entry.status, description: entry.description,
    lines: entry.lines.map((line) => ({
      id: line.id, accountCode: line.account.code, accountName: line.account.name,
      debit: line.debit.toFixed(2), credit: line.credit.toFixed(2),
    })),
    totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), difference: totalDebit.minus(totalCredit).toFixed(2),
  };
}
