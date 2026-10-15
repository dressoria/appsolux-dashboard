import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export async function getWarehouses(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryWarehouse.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getWarehouseById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryWarehouse.findFirst({ where: { id, tenantId } });
}

export async function getDefaultWarehouse(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryWarehouse.findFirst({
    where: { tenantId, isDefault: true, active: true },
  });
}

export async function ensureDefaultWarehouse(tenantId: string) {
  const existing = await getDefaultWarehouse(tenantId);
  if (existing) return existing;
  const prisma = getPrismaClient();
  return prisma.inventoryWarehouse.create({
    data: {
      tenantId,
      code: "PRINCIPAL",
      name: "Bodega Principal",
      isDefault: true,
    },
  });
}

export async function createWarehouse(
  tenantId: string,
  data: {
    code: string;
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    isDefault?: boolean;
  },
) {
  const prisma = getPrismaClient();
  if (data.isDefault) {
    await prisma.inventoryWarehouse.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }
  return prisma.inventoryWarehouse.create({
    data: { tenantId, ...data },
  });
}

export async function updateWarehouse(
  tenantId: string,
  id: string,
  data: {
    name?: string;
    address?: string;
    city?: string;
    phone?: string;
    active?: boolean;
    isDefault?: boolean;
  },
) {
  const prisma = getPrismaClient();
  if (data.isDefault) {
    await prisma.inventoryWarehouse.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }
  return prisma.inventoryWarehouse.update({
    where: { id, tenantId },
    data,
  });
}

export async function canDeleteWarehouse(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  const count = await prisma.inventoryMovement.count({
    where: { tenantId, warehouseId: id },
  });
  return count === 0;
}
