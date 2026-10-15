import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export async function getBrands(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryBrand.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
}

export async function createBrand(
  tenantId: string,
  data: { name: string; description?: string },
) {
  const prisma = getPrismaClient();
  return prisma.inventoryBrand.create({ data: { tenantId, ...data } });
}

export async function updateBrand(
  tenantId: string,
  id: string,
  data: { name?: string; description?: string; active?: boolean },
) {
  const prisma = getPrismaClient();
  return prisma.inventoryBrand.update({ where: { id, tenantId }, data });
}
