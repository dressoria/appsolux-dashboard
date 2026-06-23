import "@/lib/security/server-only";

import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import type { ProductPricingRecord } from "@/types/quick-invoice";

function toNumber(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value.toString()) : null;
}

function assertPositivePrice(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser mayor a 0.`);
  }
}

export async function listErpProductPricings(
  tenantId: string,
  itemCodes?: string[]
): Promise<ProductPricingRecord[]> {
  const prisma = getPrismaClient();
  const records = await prisma.erpProductPricing.findMany({
    where: {
      tenantId,
      ...(itemCodes?.length ? { itemCode: { in: itemCodes } } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return records.map((record) => ({
    itemCode: record.itemCode,
    itemName: record.itemName,
    retailPrice: Number(record.retailPrice.toString()),
    wholesalePrice: toNumber(record.wholesalePrice),
    distributorPrice: toNumber(record.distributorPrice),
    notes: record.notes,
  }));
}

export async function getErpProductPricingMap(
  tenantId: string,
  itemCodes?: string[]
) {
  const records = await listErpProductPricings(tenantId, itemCodes);

  return Object.fromEntries(records.map((record) => [record.itemCode, record])) as Record<
    string,
    ProductPricingRecord
  >;
}

export async function upsertErpProductPricing(input: {
  actorUserId: string;
  tenantId: string;
  itemCode: string;
  itemName?: string | null;
  retailPrice: number;
  wholesalePrice?: number | null;
  distributorPrice?: number | null;
  notes?: string | null;
}) {
  assertPositivePrice(input.retailPrice, "El precio minorista");

  if (input.wholesalePrice != null) {
    assertPositivePrice(input.wholesalePrice, "El precio mayorista");
  }

  if (input.distributorPrice != null) {
    assertPositivePrice(input.distributorPrice, "El precio distribuidor");
  }

  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const previous = await tx.erpProductPricing.findUnique({
      where: {
        tenantId_itemCode: {
          tenantId: input.tenantId,
          itemCode: input.itemCode,
        },
      },
    });

    const pricing = await tx.erpProductPricing.upsert({
      where: {
        tenantId_itemCode: {
          tenantId: input.tenantId,
          itemCode: input.itemCode,
        },
      },
      create: {
        tenantId: input.tenantId,
        itemCode: input.itemCode,
        itemName: input.itemName ?? null,
        retailPrice: new Prisma.Decimal(input.retailPrice),
        wholesalePrice:
          input.wholesalePrice != null
            ? new Prisma.Decimal(input.wholesalePrice)
            : null,
        distributorPrice:
          input.distributorPrice != null
            ? new Prisma.Decimal(input.distributorPrice)
            : null,
        notes: input.notes?.trim() || null,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      },
      update: {
        itemName: input.itemName ?? null,
        retailPrice: new Prisma.Decimal(input.retailPrice),
        wholesalePrice:
          input.wholesalePrice != null
            ? new Prisma.Decimal(input.wholesalePrice)
            : null,
        distributorPrice:
          input.distributorPrice != null
            ? new Prisma.Decimal(input.distributorPrice)
            : null,
        notes: input.notes?.trim() || null,
        updatedByUserId: input.actorUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.actorUserId,
        action: "erp_product_pricing.upserted",
        entityType: "ErpProductPricing",
        entityId: pricing.id,
        metadata: {
          itemCode: pricing.itemCode,
          itemName: pricing.itemName,
          previousRetailPrice: previous?.retailPrice?.toString() ?? null,
          nextRetailPrice: pricing.retailPrice.toString(),
          previousWholesalePrice: previous?.wholesalePrice?.toString() ?? null,
          nextWholesalePrice: pricing.wholesalePrice?.toString() ?? null,
          previousDistributorPrice:
            previous?.distributorPrice?.toString() ?? null,
          nextDistributorPrice: pricing.distributorPrice?.toString() ?? null,
        },
      },
    });

    return pricing;
  });
}
