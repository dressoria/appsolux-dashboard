import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { updateBalance, syncLegacyStock } from "@/lib/core/inventory-stock";

export async function getPhysicalCounts(
  tenantId: string,
  filters?: { status?: string; warehouseId?: string; skip?: number; take?: number },
) {
  const prisma = getPrismaClient();
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) where.status = filters.status;
  if (filters?.warehouseId) where.warehouseId = filters.warehouseId;

  const [items, total] = await Promise.all([
    prisma.inventoryPhysicalCount.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters?.skip ?? 0,
      take: filters?.take ?? 50,
    }),
    prisma.inventoryPhysicalCount.count({ where }),
  ]);
  return { items, total };
}

export async function getPhysicalCountById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryPhysicalCount.findFirst({
    where: { id, tenantId },
    include: {
      warehouse: true,
      items: {
        include: {
          product: { select: { id: true, name: true, primaryCode: true, cost: true } },
        },
      },
    },
  });
}

export async function createPhysicalCount(
  tenantId: string,
  warehouseId: string,
  userId: string,
  notes?: string,
) {
  const prisma = getPrismaClient();

  const count = await prisma.inventoryPhysicalCount.count({ where: { tenantId } });
  const number = `TF-${String(count + 1).padStart(9, "0")}`;

  const balances = await prisma.inventoryStockBalance.findMany({
    where: { tenantId, warehouseId },
    include: { product: { select: { id: true, cost: true } } },
  });

  return prisma.inventoryPhysicalCount.create({
    data: {
      tenantId,
      warehouseId,
      number,
      status: "IN_PROGRESS",
      createdByUserId: userId,
      notes,
      items: {
        create: balances.map((b) => ({
          productId: b.productId,
          expectedQuantity: b.quantity,
          unitCost: b.product.cost,
        })),
      },
    },
    include: { items: true },
  });
}

export async function updateCountItem(
  tenantId: string,
  countId: string,
  productId: string,
  countedQuantity: number,
) {
  const prisma = getPrismaClient();
  const pc = await prisma.inventoryPhysicalCount.findFirst({
    where: { id: countId, tenantId, status: { in: ["DRAFT", "IN_PROGRESS"] } },
  });
  if (!pc) throw new Error("Toma física no encontrada o ya completada.");

  const item = await prisma.inventoryPhysicalCountItem.findFirst({
    where: { physicalCountId: countId, productId },
  });
  if (!item) throw new Error("Producto no encontrado en esta toma física.");

  const counted = new Decimal(countedQuantity);
  const diff = counted.minus(item.expectedQuantity);

  return prisma.inventoryPhysicalCountItem.update({
    where: { id: item.id },
    data: { countedQuantity: counted, difference: diff },
  });
}

export async function completePhysicalCount(
  tenantId: string,
  countId: string,
  userId: string,
  allowNegative: boolean,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const pc = await tx.inventoryPhysicalCount.findFirst({
      where: { id: countId, tenantId },
      include: { items: true },
    });
    if (!pc) throw new Error("Toma física no encontrada.");
    if (pc.status === "COMPLETED") return pc;
    if (pc.status === "CANCELLED") throw new Error("Toma física cancelada.");

    const now = new Date();

    for (const item of pc.items) {
      if (item.countedQuantity === null || item.difference === null) continue;
      const diff = new Decimal(item.difference.toString());
      if (diff.isZero()) continue;

      const direction = diff.greaterThan(0) ? "IN" as const : "OUT" as const;
      const qty = diff.abs();

      const delta = direction === "IN" ? qty : qty.negated();
      await updateBalance(
        tx, tenantId, pc.warehouseId, item.productId, delta, allowNegative,
      );

      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          warehouseId: pc.warehouseId,
          direction,
          quantity: qty,
          movementType: "PHYSICAL_COUNT",
          date: now,
          reference: pc.number,
          sourceType: "physical_count",
          sourceId: pc.id,
          unitCost: item.unitCost,
          createdByUserId: userId,
        },
      });

      await syncLegacyStock(tx, tenantId, item.productId);
    }

    return tx.inventoryPhysicalCount.update({
      where: { id: countId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        completedByUserId: userId,
      },
    });
  });
}
