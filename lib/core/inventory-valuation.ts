import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getValuation(
  tenantId: string,
  filters?: { warehouseId?: string },
) {
  const prisma = getPrismaClient();

  const balanceWhere: Record<string, unknown> = { tenantId };
  if (filters?.warehouseId) balanceWhere.warehouseId = filters.warehouseId;

  const balances = await prisma.inventoryStockBalance.findMany({
    where: balanceWhere,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          primaryCode: true,
          cost: true,
        },
      },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  let totalValue = new Decimal(0);

  const rows = balances
    .filter((b) => !new Decimal(b.quantity.toString()).isZero())
    .map((b) => {
      const qty = new Decimal(b.quantity.toString());
      const avgCost = b.product.cost
        ? new Decimal(b.product.cost.toString())
        : new Decimal(0);
      const value = qty.mul(avgCost);
      totalValue = totalValue.add(value);

      return {
        productId: b.product.id,
        productName: b.product.name,
        productCode: b.product.primaryCode,
        warehouseId: b.warehouse.id,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        quantity: qty.toFixed(4),
        averageCost: avgCost.toFixed(4),
        totalValue: value.toFixed(2),
      };
    });

  return {
    rows,
    totalValue: totalValue.toFixed(2),
    method: "WEIGHTED_AVERAGE" as const,
  };
}
