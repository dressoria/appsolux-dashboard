import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { AccountingCostCenterType } from "@prisma/client";

export async function getCostCenters(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingCostCenter.findMany({
    where: { tenantId },
    orderBy: { code: "asc" },
  });
}

export async function getCostCenterById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.accountingCostCenter.findFirst({
    where: { id, tenantId },
  });
}

export async function createCostCenter(
  tenantId: string,
  data: {
    code: string;
    name: string;
    description?: string;
    type?: AccountingCostCenterType;
    parentId?: string;
  },
) {
  const prisma = getPrismaClient();
  return prisma.accountingCostCenter.create({
    data: {
      tenantId,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      type: data.type ?? "COST_CENTER",
      parentId: data.parentId ?? null,
    },
  });
}

export async function updateCostCenter(
  tenantId: string,
  id: string,
  data: { name?: string; description?: string; active?: boolean },
) {
  const prisma = getPrismaClient();
  return prisma.accountingCostCenter.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}
