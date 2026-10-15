import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getOrders(
  tenantId: string,
  filters?: { status?: string; skip?: number; take?: number },
) {
  const prisma = getPrismaClient();
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) where.status = filters.status;

  const [items, total] = await Promise.all([
    prisma.inventoryOrder.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters?.skip ?? 0,
      take: filters?.take ?? 50,
    }),
    prisma.inventoryOrder.count({ where }),
  ]);
  return { items, total };
}

export async function getOrderById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryOrder.findFirst({
    where: { id, tenantId },
    include: {
      warehouse: true,
      supplier: true,
      items: { include: { product: true } },
    },
  });
}

export async function createOrder(
  tenantId: string,
  data: {
    warehouseId: string;
    supplierId?: string;
    expectedAt?: Date;
    notes?: string;
    items: Array<{ productId: string; requestedQuantity: number; unitCostEstimate?: number }>;
    userId: string;
  },
) {
  const prisma = getPrismaClient();

  if (data.supplierId) {
    const supplier = await prisma.lightweightSupplier.findFirst({
      where: { id: data.supplierId, tenantId },
    });
    if (!supplier) throw new Error("Proveedor no pertenece a este tenant.");
  }

  const count = await prisma.inventoryOrder.count({ where: { tenantId } });
  const number = `PED-${String(count + 1).padStart(9, "0")}`;

  return prisma.inventoryOrder.create({
    data: {
      tenantId,
      number,
      warehouseId: data.warehouseId,
      supplierId: data.supplierId,
      expectedAt: data.expectedAt,
      notes: data.notes,
      createdByUserId: data.userId,
      items: {
        create: data.items.map((i) => ({
          productId: i.productId,
          requestedQuantity: new Decimal(i.requestedQuantity),
          unitCostEstimate: i.unitCostEstimate
            ? new Decimal(i.unitCostEstimate)
            : undefined,
        })),
      },
    },
    include: { items: true },
  });
}

export async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  status: string,
) {
  const prisma = getPrismaClient();
  const order = await prisma.inventoryOrder.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!order) throw new Error("Pedido no encontrado.");
  return prisma.inventoryOrder.update({
    where: { id: orderId },
    data: { status: status as never },
  });
}
