import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export type PriceChannel = "price" | "price2" | "price3" | "price4";

export const PRICE_CHANNEL_LABELS: Record<PriceChannel, string> = {
  price: "Público",
  price2: "Distribuidor",
  price3: "Mayorista",
  price4: "Tarjeta",
};

export async function previewBulkPriceUpdate(
  tenantId: string,
  productIds: string[],
  channel: PriceChannel,
  method: "increase_percent" | "decrease_percent" | "increase_value" | "decrease_value" | "cost_plus_margin",
  value: number,
) {
  const prisma = getPrismaClient();
  const products = await prisma.lightweightProduct.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true, name: true, primaryCode: true, price: true, price2: true, price3: true, price4: true, cost: true },
  });

  return products.map((p) => {
    const currentRaw = p[channel];
    const current = currentRaw ? new Decimal(currentRaw.toString()) : new Decimal(0);
    let newPrice: Decimal;

    switch (method) {
      case "increase_percent":
        newPrice = current.mul(new Decimal(1).add(new Decimal(value).div(100)));
        break;
      case "decrease_percent":
        newPrice = current.mul(new Decimal(1).minus(new Decimal(value).div(100)));
        break;
      case "increase_value":
        newPrice = current.add(new Decimal(value));
        break;
      case "decrease_value":
        newPrice = current.minus(new Decimal(value));
        break;
      case "cost_plus_margin": {
        const cost = p.cost ? new Decimal(p.cost.toString()) : new Decimal(0);
        newPrice = cost.mul(new Decimal(1).add(new Decimal(value).div(100)));
        break;
      }
    }

    if (newPrice.lessThan(0)) newPrice = new Decimal(0);

    return {
      id: p.id,
      name: p.name,
      primaryCode: p.primaryCode,
      oldPrice: current.toFixed(2),
      newPrice: newPrice.toFixed(2),
    };
  });
}

export async function confirmBulkPriceUpdate(
  tenantId: string,
  changes: Array<{ productId: string; oldPrice: string; newPrice: string }>,
  channel: PriceChannel,
  reason: string | undefined,
  userId: string,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.lightweightProduct.update({
        where: { id: change.productId, tenantId },
        data: { [channel]: new Decimal(change.newPrice) },
      });

      await tx.productPriceChange.create({
        data: {
          tenantId,
          productId: change.productId,
          channel,
          oldPrice: new Decimal(change.oldPrice),
          newPrice: new Decimal(change.newPrice),
          reason,
          userId,
        },
      });
    }
  });
}
