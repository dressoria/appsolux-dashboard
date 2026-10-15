import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { updateBalance, syncLegacyStock } from "@/lib/core/inventory-stock";
import type { InventoryMovementDirection, InventoryMovementType } from "@prisma/client";

export async function createMovement(
  tenantId: string,
  data: {
    productId: string;
    warehouseId: string;
    direction: InventoryMovementDirection;
    quantity: Decimal;
    movementType: InventoryMovementType;
    date: Date;
    reference?: string;
    description?: string;
    sourceType?: string;
    sourceId?: string;
    transferGroupId?: string;
    unitCost?: Decimal;
    createdByUserId: string;
  },
  opts?: { allowNegative?: boolean },
) {
  const prisma = getPrismaClient();
  const allowNeg = opts?.allowNegative ?? false;

  return prisma.$transaction(async (tx) => {
    if (data.sourceType && data.sourceId) {
      const existing = await tx.inventoryMovement.findFirst({
        where: {
          tenantId,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          warehouseId: data.warehouseId,
          productId: data.productId,
        },
      });
      if (existing) return existing;
    }

    const delta =
      data.direction === "IN"
        ? data.quantity
        : data.quantity.negated();

    await updateBalance(tx, tenantId, data.warehouseId, data.productId, delta, allowNeg);

    const movement = await tx.inventoryMovement.create({
      data: { tenantId, ...data },
    });

    await syncLegacyStock(tx, tenantId, data.productId);

    return movement;
  });
}

export async function createAdjustment(
  tenantId: string,
  data: {
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    type: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
    reason?: string;
    reference?: string;
    userId: string;
  },
  allowNegative: boolean,
) {
  const direction: InventoryMovementDirection =
    data.type === "ADJUSTMENT_IN" ? "IN" : "OUT";

  return createMovement(
    tenantId,
    {
      productId: data.productId,
      warehouseId: data.warehouseId,
      direction,
      quantity: data.quantity,
      movementType: data.type,
      date: new Date(),
      reference: data.reference,
      description: data.reason,
      createdByUserId: data.userId,
    },
    { allowNegative },
  );
}

export async function getMovements(
  tenantId: string,
  filters?: {
    productId?: string;
    warehouseId?: string;
    movementType?: InventoryMovementType;
    sourceType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    skip?: number;
    take?: number;
  },
) {
  const prisma = getPrismaClient();
  const where: Record<string, unknown> = { tenantId };
  if (filters?.productId) where.productId = filters.productId;
  if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters?.movementType) where.movementType = filters.movementType;
  if (filters?.sourceType) where.sourceType = filters.sourceType;
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, primaryCode: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { date: "desc" },
      skip: filters?.skip ?? 0,
      take: filters?.take ?? 50,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return { items, total };
}
