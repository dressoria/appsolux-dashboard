import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export async function getUnits(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryUnit.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
}

export async function createUnit(
  tenantId: string,
  data: { code: string; name: string; abbreviation?: string },
) {
  const prisma = getPrismaClient();
  return prisma.inventoryUnit.create({ data: { tenantId, ...data } });
}

export async function updateUnit(
  tenantId: string,
  id: string,
  data: { name?: string; abbreviation?: string; active?: boolean },
) {
  const prisma = getPrismaClient();
  return prisma.inventoryUnit.update({ where: { id, tenantId }, data });
}
