import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { ProductTaxCategory, WarrantyUnit } from "@prisma/client";

export type ProductFilters = {
  warehouseId?: string;
  type?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  stockFilter?: "all" | "in_stock" | "out_of_stock" | "low_stock";
  q?: string;
  skip?: number;
  take?: number;
};

export async function getProducts(tenantId: string, filters?: ProductFilters) {
  const prisma = getPrismaClient();
  const where: Record<string, unknown> = { tenantId };

  if (filters?.type) where.type = filters.type;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.brandId) where.brandId = filters.brandId;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  if (filters?.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { primaryCode: { contains: filters.q, mode: "insensitive" } },
      { auxiliaryCode: { contains: filters.q, mode: "insensitive" } },
      { barcode: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters?.stockFilter === "in_stock") where.stock = { gt: 0 };
  if (filters?.stockFilter === "out_of_stock") where.stock = { lte: 0 };
  if (filters?.stockFilter === "low_stock") {
    where.AND = [
      { minStock: { not: null } },
      { stock: { lte: prisma.lightweightProduct.fields?.minStock ?? 0 } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.lightweightProduct.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        inventoryUnit: { select: { id: true, name: true, abbreviation: true } },
      },
      orderBy: { name: "asc" },
      skip: filters?.skip ?? 0,
      take: filters?.take ?? 50,
    }),
    prisma.lightweightProduct.count({ where }),
  ]);

  return { items, total };
}

export async function getProductById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.lightweightProduct.findFirst({
    where: { id, tenantId },
    include: {
      category: true,
      brand: true,
      inventoryUnit: true,
      comboItems: {
        include: { componentProduct: { select: { id: true, name: true, primaryCode: true, stock: true } } },
      },
      stockBalances: {
        include: { warehouse: { select: { id: true, code: true, name: true } } },
      },
    },
  });
}

export async function createProduct(
  tenantId: string,
  data: {
    name: string;
    description?: string;
    type?: string;
    primaryCode?: string;
    auxiliaryCode?: string;
    auxiliaryTransportCode?: string;
    barcode?: string;
    categoryId?: string;
    unitId?: string;
    brandId?: string;
    defaultWarehouseId?: string;
    price: number;
    price2?: number;
    price3?: number;
    price4?: number;
    cost?: number;
    taxRate?: number;
    taxCategory?: ProductTaxCategory;
    trackInventory?: boolean;
    minStock?: number;
    salesAccountId?: string;
    inventoryAccountId?: string;
    cogsAccountId?: string;
    purchaseAccountId?: string;
    color?: string;
    additionalComment?: string;
    isProcessed?: boolean;
    warrantyDuration?: number;
    warrantyUnit?: WarrantyUnit;
    expiresAt?: Date;
  },
) {
  const prisma = getPrismaClient();

  if (data.categoryId) {
    const cat = await prisma.lightweightProductCategory.findFirst({
      where: { id: data.categoryId, tenantId },
    });
    if (!cat) throw new Error("Categoría no pertenece a este tenant.");
  }
  if (data.brandId) {
    const brand = await prisma.inventoryBrand.findFirst({
      where: { id: data.brandId, tenantId },
    });
    if (!brand) throw new Error("Marca no pertenece a este tenant.");
  }
  if (data.unitId) {
    const unit = await prisma.inventoryUnit.findFirst({
      where: { id: data.unitId, tenantId },
    });
    if (!unit) throw new Error("Unidad no pertenece a este tenant.");
  }
  if (data.salesAccountId) {
    const acc = await prisma.accountingAccount.findFirst({
      where: { id: data.salesAccountId, tenantId, active: true, allowsPosting: true },
    });
    if (!acc) throw new Error("Cuenta contable de venta inválida.");
  }
  if (data.inventoryAccountId) {
    const acc = await prisma.accountingAccount.findFirst({
      where: { id: data.inventoryAccountId, tenantId, active: true, allowsPosting: true },
    });
    if (!acc) throw new Error("Cuenta contable de inventario inválida.");
  }
  if (data.cogsAccountId) {
    const acc = await prisma.accountingAccount.findFirst({
      where: { id: data.cogsAccountId, tenantId, active: true, allowsPosting: true },
    });
    if (!acc) throw new Error("Cuenta contable de costos inválida.");
  }

  return prisma.lightweightProduct.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      type: (data.type as never) ?? "PRODUCT",
      primaryCode: data.primaryCode,
      auxiliaryCode: data.auxiliaryCode,
      auxiliaryTransportCode: data.auxiliaryTransportCode,
      barcode: data.barcode,
      categoryId: data.categoryId,
      unitId: data.unitId,
      brandId: data.brandId,
      defaultWarehouseId: data.defaultWarehouseId,
      price: new Decimal(data.price),
      price2: data.price2 != null ? new Decimal(data.price2) : undefined,
      price3: data.price3 != null ? new Decimal(data.price3) : undefined,
      price4: data.price4 != null ? new Decimal(data.price4) : undefined,
      cost: data.cost != null ? new Decimal(data.cost) : undefined,
      taxRate: new Decimal(data.taxRate ?? 0),
      taxCategory: data.taxCategory,
      trackInventory: data.trackInventory ?? true,
      minStock: data.minStock,
      salesAccountId: data.salesAccountId,
      inventoryAccountId: data.inventoryAccountId,
      cogsAccountId: data.cogsAccountId,
      purchaseAccountId: data.purchaseAccountId,
      color: data.color,
      additionalComment: data.additionalComment,
      isProcessed: data.isProcessed ?? false,
      warrantyDuration: data.warrantyDuration,
      warrantyUnit: data.warrantyUnit,
      expiresAt: data.expiresAt,
    },
  });
}

export async function updateProduct(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
) {
  const prisma = getPrismaClient();
  const product = await prisma.lightweightProduct.findFirst({
    where: { id, tenantId },
  });
  if (!product) throw new Error("Producto no encontrado.");
  return prisma.lightweightProduct.update({ where: { id }, data });
}
