import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { AccountingPlanStatus } from "@prisma/client";

export async function getActivePlan(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingPlan.findFirst({
    where: { tenantId, status: "ACTIVE" },
  });
}

export async function getPlans(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingPlan.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPlanById(tenantId: string, planId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingPlan.findFirst({
    where: { id: planId, tenantId },
  });
}

export async function createPlan(
  tenantId: string,
  data: { name: string; description?: string; source?: string },
  createdByUserId: string,
) {
  const prisma = getPrismaClient();
  return prisma.accountingPlan.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description ?? null,
      source: data.source ?? null,
      status: "DRAFT",
      createdByUserId,
    },
  });
}

export async function updatePlanStatus(
  tenantId: string,
  planId: string,
  status: AccountingPlanStatus,
) {
  const prisma = getPrismaClient();

  if (status === "ACTIVE") {
    await prisma.$transaction([
      prisma.accountingPlan.updateMany({
        where: { tenantId, status: "ACTIVE", id: { not: planId } },
        data: { status: "ARCHIVED" },
      }),
      prisma.accountingPlan.update({
        where: { id: planId },
        data: { status },
      }),
    ]);
    return prisma.accountingPlan.findUnique({ where: { id: planId } });
  }

  return prisma.accountingPlan.update({
    where: { id: planId },
    data: { status },
  });
}
