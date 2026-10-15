import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getKardex(
  tenantId: string,
  productId: string,
  filters?: {
    warehouseId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
) {
  const prisma = getPrismaClient();

  const openingWhere: Record<string, unknown> = { tenantId, productId };
  if (filters?.warehouseId) openingWhere.warehouseId = filters.warehouseId;
  if (filters?.dateFrom) openingWhere.date = { lt: filters.dateFrom };

  const priorMovements = filters?.dateFrom
    ? await prisma.inventoryMovement.findMany({ where: openingWhere })
    : [];

  let openingBalance = new Decimal(0);
  for (const m of priorMovements) {
    const qty = new Decimal(m.quantity.toString());
    openingBalance = m.direction === "IN"
      ? openingBalance.add(qty)
      : openingBalance.minus(qty);
  }

  const where: Record<string, unknown> = { tenantId, productId };
  if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {
      ...(filters?.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters?.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, primaryCode: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  let runningBalance = openingBalance;
  const rows = movements.map((m) => {
    const qty = new Decimal(m.quantity.toString());
    const inQty = m.direction === "IN" ? qty : new Decimal(0);
    const outQty = m.direction === "OUT" ? qty : new Decimal(0);
    runningBalance = runningBalance.add(inQty).minus(outQty);
    const unitCostVal = m.unitCost ? new Decimal(m.unitCost.toString()) : null;
    const value = unitCostVal ? runningBalance.mul(unitCostVal) : null;

    return {
      id: m.id,
      date: m.date,
      movementType: m.movementType,
      reference: m.reference,
      description: m.description,
      inQty: inQty.toFixed(4),
      outQty: outQty.toFixed(4),
      unitCost: unitCostVal?.toFixed(4) ?? null,
      balance: runningBalance.toFixed(4),
      value: value?.toFixed(2) ?? null,
      warehouse: m.warehouse,
    };
  });

  return {
    openingBalance: openingBalance.toFixed(4),
    rows,
    closingBalance: runningBalance.toFixed(4),
  };
}
