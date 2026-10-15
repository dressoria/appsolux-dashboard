import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { AccountingSourceType, AccountingJournalEntryStatus } from "@prisma/client";

export type JournalLineInput = {
  accountId: string;
  description?: string;
  debit: string;
  credit: string;
  costCenterId?: string;
  counterpartyType?: string;
  counterpartyId?: string;
  reference?: string;
};

export type CreateJournalEntryInput = {
  date: Date;
  description: string;
  sourceType?: AccountingSourceType;
  sourceId?: string;
  lines: JournalLineInput[];
};

function validateLines(lines: JournalLineInput[]) {
  if (lines.length < 2) {
    throw new Error("Un asiento contable requiere al menos 2 líneas");
  }

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  for (const line of lines) {
    const debit = new Decimal(line.debit || "0");
    const credit = new Decimal(line.credit || "0");

    if (debit.isNegative() || credit.isNegative()) {
      throw new Error("Los valores de débito y crédito no pueden ser negativos");
    }
    if (debit.greaterThan(0) && credit.greaterThan(0)) {
      throw new Error("Una línea no puede tener débito y crédito simultáneamente");
    }
    if (debit.isZero() && credit.isZero()) {
      throw new Error("Una línea debe tener débito o crédito");
    }

    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new Error(
      `El asiento no cuadra: débito=${totalDebit.toFixed(2)}, crédito=${totalCredit.toFixed(2)}`,
    );
  }

  return { totalDebit, totalCredit };
}

async function generateNextNumber(tenantId: string): Promise<string> {
  const prisma = getPrismaClient();

  const last = await prisma.accountingJournalEntry.findFirst({
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

  return `ASICOM-${String(seq).padStart(9, "0")}`;
}

export async function createJournalEntry(
  tenantId: string,
  data: CreateJournalEntryInput,
  createdByUserId: string,
) {
  const { totalDebit, totalCredit } = validateLines(data.lines);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const number = await (async () => {
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
      return `ASICOM-${String(seq).padStart(9, "0")}`;
    })();

    const entry = await tx.accountingJournalEntry.create({
      data: {
        tenantId,
        number,
        date: data.date,
        description: data.description,
        sourceType: data.sourceType ?? "MANUAL",
        sourceId: data.sourceId ?? null,
        status: "DRAFT",
        totalDebit,
        totalCredit,
        createdByUserId,
      },
    });

    await tx.accountingJournalLine.createMany({
      data: data.lines.map((line) => ({
        tenantId,
        entryId: entry.id,
        accountId: line.accountId,
        description: line.description ?? null,
        debit: new Decimal(line.debit || "0"),
        credit: new Decimal(line.credit || "0"),
        costCenterId: line.costCenterId ?? null,
        counterpartyType: line.counterpartyType ?? null,
        counterpartyId: line.counterpartyId ?? null,
        reference: line.reference ?? null,
      })),
    });

    return tx.accountingJournalEntry.findUnique({
      where: { id: entry.id },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  });
}

export async function postJournalEntry(
  tenantId: string,
  entryId: string,
  postedByUserId: string,
) {
  const prisma = getPrismaClient();

  const entry = await prisma.accountingJournalEntry.findFirst({
    where: { id: entryId, tenantId },
  });

  if (!entry) throw new Error("Asiento no encontrado");
  if (entry.status !== "DRAFT") throw new Error("Solo se pueden contabilizar asientos en borrador");

  return prisma.accountingJournalEntry.update({
    where: { id: entryId },
    data: {
      status: "POSTED",
      postedByUserId,
      postedAt: new Date(),
    },
  });
}

export async function reverseJournalEntry(
  tenantId: string,
  entryId: string,
  reversedByUserId: string,
  reversalDate: Date,
) {
  const prisma = getPrismaClient();

  const entry = await prisma.accountingJournalEntry.findFirst({
    where: { id: entryId, tenantId },
    include: { lines: true },
  });

  if (!entry) throw new Error("Asiento no encontrado");
  if (entry.status !== "POSTED") throw new Error("Solo se pueden reversar asientos contabilizados");

  const reversalLines: JournalLineInput[] = entry.lines.map((line) => ({
    accountId: line.accountId,
    description: `Reversión: ${line.description ?? ""}`,
    debit: line.credit.toString(),
    credit: line.debit.toString(),
    costCenterId: line.costCenterId ?? undefined,
    counterpartyType: line.counterpartyType ?? undefined,
    counterpartyId: line.counterpartyId ?? undefined,
    reference: line.reference ?? undefined,
  }));

  return prisma.$transaction(async (tx) => {
    await tx.accountingJournalEntry.update({
      where: { id: entryId },
      data: {
        status: "REVERSED",
        reversedByUserId,
        reversedAt: new Date(),
      },
    });

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

    const reversal = await tx.accountingJournalEntry.create({
      data: {
        tenantId,
        number,
        date: reversalDate,
        description: `Reversión de ${entry.number}: ${entry.description}`,
        sourceType: "REVERSAL",
        sourceId: entry.id,
        status: "POSTED",
        totalDebit: entry.totalCredit,
        totalCredit: entry.totalDebit,
        reversalOfId: entry.id,
        createdByUserId: reversedByUserId,
        postedByUserId: reversedByUserId,
        postedAt: new Date(),
      },
    });

    await tx.accountingJournalLine.createMany({
      data: reversalLines.map((line) => ({
        tenantId,
        entryId: reversal.id,
        accountId: line.accountId,
        description: line.description ?? null,
        debit: new Decimal(line.debit || "0"),
        credit: new Decimal(line.credit || "0"),
        costCenterId: line.costCenterId ?? null,
        counterpartyType: line.counterpartyType ?? null,
        counterpartyId: line.counterpartyId ?? null,
        reference: line.reference ?? null,
      })),
    });

    return reversal;
  });
}

export async function getJournalEntries(
  tenantId: string,
  filters: {
    status?: AccountingJournalEntryStatus;
    dateFrom?: Date;
    dateTo?: Date;
    sourceType?: AccountingSourceType;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const prisma = getPrismaClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Record<string, unknown> = { tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.sourceType) where.sourceType = filters.sourceType;
  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom && { gte: filters.dateFrom }),
      ...(filters.dateTo && { lte: filters.dateTo }),
    };
  }
  if (filters.search) {
    where.OR = [
      { number: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [entries, total] = await Promise.all([
    prisma.accountingJournalEntry.findMany({
      where,
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accountingJournalEntry.count({ where }),
  ]);

  return { entries, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getJournalEntryById(tenantId: string, entryId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingJournalEntry.findFirst({
    where: { id: entryId, tenantId },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true } },
          costCenter: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
