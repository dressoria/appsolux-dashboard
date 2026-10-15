import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { AccountingPeriodStatus } from "@prisma/client";

export async function getPeriods(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingPeriod.findMany({
    where: { tenantId },
    orderBy: [{ year: "desc" }, { month: "asc" }],
  });
}

export async function getPeriodByYearMonth(
  tenantId: string,
  year: number,
  month: number | null,
) {
  const prisma = getPrismaClient();
  return prisma.accountingPeriod.findFirst({
    where: { tenantId, year, month: month ?? 0 },
  });
}

export async function ensurePeriodOpen(tenantId: string, date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const prisma = getPrismaClient();
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId,
      year,
      OR: [{ month }, { month: 0 }],
      status: { in: ["CLOSED", "LOCKED"] },
    },
  });

  if (period) {
    throw new Error(
      `El período ${year}${period.month ? `-${String(period.month).padStart(2, "0")}` : ""} está ${period.status === "LOCKED" ? "bloqueado" : "cerrado"}`,
    );
  }
}

export async function updatePeriodStatus(
  tenantId: string,
  periodId: string,
  status: AccountingPeriodStatus,
  userId: string,
) {
  const prisma = getPrismaClient();

  const period = await prisma.accountingPeriod.findFirst({
    where: { id: periodId, tenantId },
  });
  if (!period) throw new Error("Período no encontrado");

  if (period.status === "LOCKED" && status !== "LOCKED") {
    throw new Error("Un período bloqueado no se puede reabrir");
  }

  return prisma.accountingPeriod.update({
    where: { id: periodId },
    data: {
      status,
      ...(status === "CLOSED" || status === "LOCKED"
        ? { closedAt: new Date(), closedByUserId: userId }
        : {}),
    },
  });
}

export async function createPeriod(
  tenantId: string,
  data: { year: number; month?: number },
) {
  const prisma = getPrismaClient();
  const month = data.month ?? 0;
  const startDate =
    month > 0 ? new Date(data.year, month - 1, 1) : new Date(data.year, 0, 1);
  const endDate =
    month > 0
      ? new Date(data.year, month, 0, 23, 59, 59, 999)
      : new Date(data.year, 11, 31, 23, 59, 59, 999);

  return prisma.accountingPeriod.create({
    data: {
      tenantId,
      year: data.year,
      month,
      startDate,
      endDate,
      status: "OPEN",
    },
  });
}
