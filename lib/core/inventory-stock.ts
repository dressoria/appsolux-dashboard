import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function getStockBalance(
  tenantId: string,
  productId: string,
  warehouseId: string,
) {
  const prisma = getPrismaClient();
  const balance = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_warehouseId_productId: { tenantId, warehouseId, productId },
    },
  });
  return balance?.quantity ?? new Decimal(0);
}

export async function getProductStockByWarehouse(
  tenantId: string,
  productId: string,
) {
  const prisma = getPrismaClient();
  return prisma.inventoryStockBalance.findMany({
    where: { tenantId, productId },
    include: { warehouse: { select: { code: true, name: true } } },
  });
}

export async function getTotalStock(tenantId: string, productId: string) {
  const prisma = getPrismaClient();
  const result = await prisma.inventoryStockBalance.aggregate({
    where: { tenantId, productId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? new Decimal(0);
}

export async function updateBalance(
  tx: Tx,
  tenantId: string,
  warehouseId: string,
  productId: string,
  delta: Decimal,
  allowNegative: boolean,
) {
  const existing = await tx.inventoryStockBalance.findUnique({
    where: {
      tenantId_warehouseId_productId: { tenantId, warehouseId, productId },
    },
  });

  const currentQty = existing?.quantity ?? new Decimal(0);
  const newQty = currentQty.add(delta);

  if (!allowNegative && newQty.lessThan(new Decimal(0))) {
    throw new Error(
      `Stock insuficiente. Disponible: ${currentQty.toFixed(4)}, requerido: ${delta.abs().toFixed(4)}`,
    );
  }

  await tx.inventoryStockBalance.upsert({
    where: {
      tenantId_warehouseId_productId: { tenantId, warehouseId, productId },
    },
    create: { tenantId, warehouseId, productId, quantity: newQty },
    update: { quantity: newQty },
  });

  return newQty;
}

export async function syncLegacyStock(
  tx: Tx,
  tenantId: string,
  productId: string,
) {
  const result = await tx.inventoryStockBalance.aggregate({
    where: { tenantId, productId },
    _sum: { quantity: true },
  });
  const total = result._sum.quantity ?? new Decimal(0);
  await tx.lightweightProduct.update({
    where: { id: productId },
    data: { stock: Math.round(total.toNumber()) },
  });
}
