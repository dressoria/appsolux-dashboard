import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { updateBalance, syncLegacyStock } from "@/lib/core/inventory-stock";
import { randomUUID } from "crypto";

export async function getTransfers(
  tenantId: string,
  filters?: { status?: string; skip?: number; take?: number },
) {
  const prisma = getPrismaClient();
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.inventoryTransfer.findMany({
      where,
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destinationWarehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, primaryCode: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: filters?.skip ?? 0,
      take: filters?.take ?? 50,
    }),
    prisma.inventoryTransfer.count({ where }),
  ]);
  return { items, total };
}

export async function getTransferById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryTransfer.findFirst({
    where: { id, tenantId },
    include: {
      sourceWarehouse: true,
      destinationWarehouse: true,
      items: { include: { product: true } },
    },
  });
}

export async function createTransfer(
  tenantId: string,
  data: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
    userId: string;
  },
) {
  if (data.sourceWarehouseId === data.destinationWarehouseId) {
    throw new Error("La bodega origen y destino no pueden ser la misma.");
  }
  const prisma = getPrismaClient();

  const count = await prisma.inventoryTransfer.count({ where: { tenantId } });
  const number = `TRF-${String(count + 1).padStart(9, "0")}`;

  return prisma.inventoryTransfer.create({
    data: {
      tenantId,
      number,
      sourceWarehouseId: data.sourceWarehouseId,
      destinationWarehouseId: data.destinationWarehouseId,
      createdByUserId: data.userId,
      notes: data.notes,
      items: {
        create: data.items.map((i) => ({
          productId: i.productId,
          quantity: new Decimal(i.quantity),
        })),
      },
    },
    include: { items: true },
  });
}

export async function completeTransfer(
  tenantId: string,
  transferId: string,
  userId: string,
  allowNegative: boolean,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.inventoryTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: { items: true },
    });
    if (!transfer) throw new Error("Transferencia no encontrada.");
    if (transfer.status === "COMPLETED") return transfer;
    if (transfer.status === "CANCELLED") {
      throw new Error("Transferencia cancelada, no se puede completar.");
    }

    const groupId = randomUUID();
    const now = new Date();

    for (const item of transfer.items) {
      const qty = new Decimal(item.quantity.toString());

      await updateBalance(
        tx,
        tenantId,
        transfer.sourceWarehouseId,
        item.productId,
        qty.negated(),
        allowNegative,
      );
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          warehouseId: transfer.sourceWarehouseId,
          direction: "OUT",
          quantity: qty,
          movementType: "TRANSFER_OUT",
          date: now,
          reference: transfer.number,
          sourceType: "transfer",
          sourceId: transfer.id,
          transferGroupId: groupId,
          createdByUserId: userId,
        },
      });

      await updateBalance(
        tx,
        tenantId,
        transfer.destinationWarehouseId,
        item.productId,
        qty,
        true,
      );
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          warehouseId: transfer.destinationWarehouseId,
          direction: "IN",
          quantity: qty,
          movementType: "TRANSFER_IN",
          date: now,
          reference: transfer.number,
          sourceType: "transfer",
          sourceId: transfer.id,
          transferGroupId: groupId,
          createdByUserId: userId,
        },
      });

      await syncLegacyStock(tx, tenantId, item.productId);
    }

    return tx.inventoryTransfer.update({
      where: { id: transferId },
      data: {
        status: "COMPLETED",
        completedByUserId: userId,
        completedAt: now,
      },
    });
  });
}
