import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function getShipmentGuides(
  tenantId: string,
  filters?: {
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    skip?: number;
    take?: number;
  },
) {
  const prisma = getPrismaClient();
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) where.status = filters.status;
  if (filters?.dateFrom || filters?.dateTo) {
    where.issueDate = {
      ...(filters?.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters?.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.shipmentGuide.findMany({
      where,
      include: {
        vehicle: { select: { id: true, plate: true, brand: true } },
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { issueDate: "desc" },
      skip: filters?.skip ?? 0,
      take: filters?.take ?? 50,
    }),
    prisma.shipmentGuide.count({ where }),
  ]);
  return { items, total };
}

export async function getShipmentGuideById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.shipmentGuide.findFirst({
    where: { id, tenantId },
    include: {
      vehicle: true,
      sourceWarehouse: true,
      items: { include: { product: { select: { id: true, name: true, primaryCode: true } } } },
    },
  });
}

export async function createShipmentGuide(
  tenantId: string,
  data: {
    issueDate: Date;
    startTransportDate: Date;
    endTransportDate?: Date;
    originAddress: string;
    destinationAddress: string;
    route?: string;
    reason: string;
    carrierIdentification?: string;
    carrierName?: string;
    vehicleId?: string;
    sourceWarehouseId?: string;
    saleId?: string;
    transferId?: string;
    notes?: string;
    items: Array<{ productId?: string; code: string; description: string; quantity: number }>;
    userId: string;
  },
) {
  const prisma = getPrismaClient();

  if (data.vehicleId) {
    const vehicle = await prisma.inventoryVehicle.findFirst({
      where: { id: data.vehicleId, tenantId },
    });
    if (!vehicle) throw new Error("Vehículo no pertenece a este tenant.");
  }

  const count = await prisma.shipmentGuide.count({ where: { tenantId } });
  const number = `GR-${String(count + 1).padStart(9, "0")}`;

  return prisma.shipmentGuide.create({
    data: {
      tenantId,
      number,
      issueDate: data.issueDate,
      startTransportDate: data.startTransportDate,
      endTransportDate: data.endTransportDate,
      originAddress: data.originAddress,
      destinationAddress: data.destinationAddress,
      route: data.route,
      reason: data.reason,
      carrierIdentification: data.carrierIdentification,
      carrierName: data.carrierName,
      vehicleId: data.vehicleId,
      sourceWarehouseId: data.sourceWarehouseId,
      saleId: data.saleId,
      transferId: data.transferId,
      notes: data.notes,
      createdByUserId: data.userId,
      items: {
        create: data.items.map((i) => ({
          productId: i.productId,
          code: i.code,
          description: i.description,
          quantity: new Decimal(i.quantity),
        })),
      },
    },
    include: { items: true },
  });
}

export async function updateShipmentGuideStatus(
  tenantId: string,
  guideId: string,
  status: "ISSUED" | "CANCELLED",
) {
  const prisma = getPrismaClient();
  const guide = await prisma.shipmentGuide.findFirst({
    where: { id: guideId, tenantId },
  });
  if (!guide) throw new Error("Guía no encontrada.");
  if (guide.status !== "DRAFT") {
    throw new Error("Solo se pueden modificar guías en borrador.");
  }
  return prisma.shipmentGuide.update({
    where: { id: guideId },
    data: { status },
  });
}

export async function getVehicles(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.inventoryVehicle.findMany({
    where: { tenantId },
    orderBy: { plate: "asc" },
  });
}

export async function createVehicle(
  tenantId: string,
  data: {
    plate: string;
    brand?: string;
    model?: string;
    year?: number;
    color?: string;
    notes?: string;
  },
) {
  const prisma = getPrismaClient();
  return prisma.inventoryVehicle.create({
    data: { tenantId, ...data },
  });
}

export async function updateVehicle(
  tenantId: string,
  id: string,
  data: {
    plate?: string;
    brand?: string;
    model?: string;
    year?: number;
    color?: string;
    notes?: string;
    active?: boolean;
  },
) {
  const prisma = getPrismaClient();
  return prisma.inventoryVehicle.update({
    where: { id, tenantId },
    data,
  });
}
