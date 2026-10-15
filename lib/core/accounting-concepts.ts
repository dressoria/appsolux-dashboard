import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export async function getCostExpenseConcepts(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingCostExpenseConcept.findMany({
    where: { tenantId },
    include: {
      costAccount: { select: { id: true, code: true, name: true } },
      expenseAccount: { select: { id: true, code: true, name: true } },
    },
    orderBy: { code: "asc" },
  });
}

export async function createCostExpenseConcept(
  tenantId: string,
  data: {
    code: string;
    name: string;
    description?: string;
    costAccountId?: string;
    expenseAccountId?: string;
  },
) {
  const prisma = getPrismaClient();
  return prisma.accountingCostExpenseConcept.create({
    data: {
      tenantId,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      costAccountId: data.costAccountId ?? null,
      expenseAccountId: data.expenseAccountId ?? null,
    },
  });
}

export async function updateCostExpenseConcept(
  tenantId: string,
  id: string,
  data: {
    name?: string;
    description?: string;
    costAccountId?: string | null;
    expenseAccountId?: string | null;
    active?: boolean;
  },
) {
  const prisma = getPrismaClient();
  return prisma.accountingCostExpenseConcept.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.costAccountId !== undefined && { costAccountId: data.costAccountId }),
      ...(data.expenseAccountId !== undefined && { expenseAccountId: data.expenseAccountId }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}
