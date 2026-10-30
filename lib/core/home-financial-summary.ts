import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

export type FinancialSummary = {
  salesMonth: number;
  salesPrevMonth: number;
  purchasesMonth: number;
  purchasesPrevMonth: number;
  receivables: number;
  receivablesCount: number;
  payables: number;
  payablesCount: number;
};

export async function getFinancialSummary(
  tenantId: string,
): Promise<FinancialSummary> {
  const prisma = getPrismaClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    salesMonthAgg,
    salesPrevMonthAgg,
    purchasesMonthAgg,
    purchasesPrevMonthAgg,
    receivablesAgg,
    payablesAgg,
  ] = await Promise.all([
    prisma.lightweightSale.aggregate({
      where: { tenantId, status: { not: "canceled" }, createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    prisma.lightweightSale.aggregate({
      where: {
        tenantId,
        status: { not: "canceled" },
        createdAt: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { total: true },
    }),
    prisma.purchaseDocument.aggregate({
      where: {
        tenantId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        issueDate: { gte: monthStart },
      },
      _sum: { total: true },
    }),
    prisma.purchaseDocument.aggregate({
      where: {
        tenantId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        issueDate: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { total: true },
    }),
    prisma.treasuryObligation.aggregate({
      where: {
        tenantId,
        type: "RECEIVABLE",
        status: { in: ["OPEN", "PARTIAL", "OVERDUE"] },
      },
      _sum: { balance: true },
      _count: true,
    }),
    prisma.treasuryObligation.aggregate({
      where: {
        tenantId,
        type: "PAYABLE",
        status: { in: ["OPEN", "PARTIAL", "OVERDUE"] },
      },
      _sum: { balance: true },
      _count: true,
    }),
  ]);

  return {
    salesMonth: Number(salesMonthAgg._sum.total?.toString() ?? "0"),
    salesPrevMonth: Number(salesPrevMonthAgg._sum.total?.toString() ?? "0"),
    purchasesMonth: Number(purchasesMonthAgg._sum.total?.toString() ?? "0"),
    purchasesPrevMonth: Number(purchasesPrevMonthAgg._sum.total?.toString() ?? "0"),
    receivables: Number(receivablesAgg._sum.balance?.toString() ?? "0"),
    receivablesCount: receivablesAgg._count,
    payables: Number(payablesAgg._sum.balance?.toString() ?? "0"),
    payablesCount: payablesAgg._count,
  };
}

export function formatPercentChange(current: number, previous: number): { text: string; positive: boolean | null } {
  if (previous === 0 && current > 0) return { text: "Nuevo este mes", positive: true };
  if (previous === 0 && current === 0) return { text: "Sin cambios", positive: null };
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0 };
}
