import "@/lib/security/server-only";

import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import {
  calculateProformaTotals,
  type ProformaCalculationLine,
} from "@/lib/core/proforma-calculations";

export type ProformaLineInput = ProformaCalculationLine;

export type SaveProformaInput = {
  tenantId: string;
  userId: string;
  userName: string;
  customerId?: string;
  establishmentId?: string;
  issueDate: Date;
  validUntil?: Date;
  observation?: string;
  items: ProformaLineInput[];
};

async function prepareData(input: SaveProformaInput) {
  const prisma = getPrismaClient();
  if (!input.items.length) throw new Error("Agrega al menos un producto.");
  const [customer, establishment, products] = await Promise.all([
    input.customerId
      ? prisma.lightweightCustomer.findFirst({
          where: { id: input.customerId, tenantId: input.tenantId },
        })
      : null,
    input.establishmentId
      ? prisma.sriEstablishment.findFirst({
          where: { id: input.establishmentId, tenantId: input.tenantId },
        })
      : null,
    prisma.lightweightProduct.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: input.items.map((item) => item.productId) },
      },
    }),
  ]);
  if (input.customerId && !customer) throw new Error("Cliente no válido.");
  if (input.establishmentId && !establishment)
    throw new Error("Establecimiento no válido.");
  const productById = new Map(products.map((product) => [product.id, product]));
  if (
    productById.size !== new Set(input.items.map((item) => item.productId)).size
  )
    throw new Error("Uno o más productos no pertenecen a la empresa.");
  const totals = calculateProformaTotals(input.items);
  return {
    customerSnapshot: {
      name: customer?.name ?? "Consumidor Final",
      tradeName: customer?.tradeName ?? null,
      identification: customer?.identification ?? "9999999999999",
      phone: customer?.phone ?? null,
      email: customer?.email ?? null,
      address: customer?.address ?? null,
    },
    establishmentSnapshot: establishment
      ? {
          code: establishment.code,
          name: establishment.name,
          address: establishment.address,
        }
      : null,
    totals,
    productById,
  };
}

export async function createProforma(input: SaveProformaInput) {
  const prisma = getPrismaClient();
  const prepared = await prepareData(input);
  return prisma.$transaction(
    async (tx) => {
      const year = input.issueDate.getUTCFullYear();
      const prefix = `PRO-${year}-`;
      const latest = await tx.lightweightProforma.findFirst({
        where: { tenantId: input.tenantId, number: { startsWith: prefix } },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const next = Number(latest?.number.slice(prefix.length) ?? 0) + 1;
      const number = `${prefix}${String(next).padStart(6, "0")}`;
      return tx.lightweightProforma.create({
        data: {
          tenantId: input.tenantId,
          number,
          customerId: input.customerId || null,
          customerSnapshot: prepared.customerSnapshot,
          establishmentId: input.establishmentId || null,
          establishmentSnapshot:
            prepared.establishmentSnapshot ?? Prisma.JsonNull,
          issueDate: input.issueDate,
          validUntil: input.validUntil,
          sellerId: input.userId,
          sellerName: input.userName,
          observation: input.observation,
          status: "ACTIVE",
          createdBy: input.userId,
          subtotal: prepared.totals.subtotal,
          discount: prepared.totals.discount,
          tax: prepared.totals.tax,
          total: prepared.totals.total,
          items: {
            create: prepared.totals.items.map((item) => {
              const product = prepared.productById.get(item.productId)!;
              return {
                productId: product.id,
                code: product.primaryCode ?? product.barcode,
                productName: product.name,
                description: product.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                taxRate: item.taxRate,
                subtotal: item.subtotal,
                tax: item.tax,
                total: item.total,
                observation: item.observation,
              };
            }),
          },
        },
        include: { items: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateProforma(id: string, input: SaveProformaInput) {
  const prisma = getPrismaClient();
  const current = await prisma.lightweightProforma.findFirst({
    where: { id, tenantId: input.tenantId },
  });
  if (!current) throw new Error("Proforma no encontrada.");
  const prepared = await prepareData(input);
  return prisma.$transaction(async (tx) => {
    await tx.lightweightProformaItem.deleteMany({ where: { proformaId: id } });
    return tx.lightweightProforma.update({
      where: { id },
      data: {
        customerId: input.customerId || null,
        customerSnapshot: prepared.customerSnapshot,
        establishmentId: input.establishmentId || null,
        establishmentSnapshot:
          prepared.establishmentSnapshot ?? Prisma.JsonNull,
        issueDate: input.issueDate,
        validUntil: input.validUntil,
        observation: input.observation,
        subtotal: prepared.totals.subtotal,
        discount: prepared.totals.discount,
        tax: prepared.totals.tax,
        total: prepared.totals.total,
        items: {
          create: prepared.totals.items.map((item) => {
            const product = prepared.productById.get(item.productId)!;
            return {
              productId: product.id,
              code: product.primaryCode ?? product.barcode,
              productName: product.name,
              description: product.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              subtotal: item.subtotal,
              tax: item.tax,
              total: item.total,
              observation: item.observation,
            };
          }),
        },
      },
      include: { items: true },
    });
  });
}

export async function getProforma(tenantId: string, id: string) {
  return getPrismaClient().lightweightProforma.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
}

export async function listProformas(
  tenantId: string,
  filters: { search?: string; from?: Date; to?: Date },
) {
  return getPrismaClient().lightweightProforma.findMany({
    where: {
      tenantId,
      ...(filters.from || filters.to
        ? { issueDate: { gte: filters.from, lte: filters.to } }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { number: { contains: filters.search, mode: "insensitive" } },
              {
                customer: {
                  name: { contains: filters.search, mode: "insensitive" },
                },
              },
              {
                customer: {
                  identification: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: { customer: true },
    orderBy: { issueDate: "desc" },
    take: 500,
  });
}
