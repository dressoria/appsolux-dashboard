import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { normalizeProductInput, ProductInputError } from "./inventory-product-input";

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

type ProductClient = Pick<Prisma.TransactionClient, "lightweightProduct" | "lightweightProductCategory" | "inventoryBrand" | "inventoryUnit" | "inventoryWarehouse" | "accountingAccount">;

async function prepareProduct(tenantId: string, input: Record<string, unknown>, db: ProductClient, existing?: Record<string, unknown>) {
  const previous = existing ? { ...existing } : undefined;
  if (previous) for (const key of ["price", "price2", "price3", "price4", "cost", "taxRate"]) {
    if (previous[key] != null) previous[key] = Number(previous[key]);
  }
  const data = normalizeProductInput(input, previous);
  // Resolve existing optional defaults; never create catalog rows while saving.
  for (const [field, defaultName] of [
    ["categoryId", "SIN CATEGORÍA"],
    ["brandId", "SIN MARCA"],
    ["unitId", "SIN UNIDAD"],
  ] as const) {
    const where = data[field] ? { tenantId, id: data[field] } : { tenantId, name: defaultName };
    const record = field === "categoryId" ? await db.lightweightProductCategory.findFirst({ where })
      : field === "brandId" ? await db.inventoryBrand.findFirst({ where })
      : await db.inventoryUnit.findFirst({ where });
    if (data[field] && !record) throw new ProductInputError(`${defaultName === "SIN MARCA" ? "Marca" : field === "unitId" ? "Unidad" : "Categoría"} no pertenece a este tenant.`, field);
    data[field] = record?.id ?? null;
  }
  if (data.defaultWarehouseId || data.trackInventory) {
    const warehouse = await db.inventoryWarehouse.findFirst({ where: {
      tenantId, active: true, ...(data.defaultWarehouseId ? { id: data.defaultWarehouseId } : { isDefault: true }),
    } });
    if (!warehouse) throw new ProductInputError(data.defaultWarehouseId ? "Bodega inválida para este tenant." : "Configura una bodega predeterminada antes de crear productos con inventario.", "defaultWarehouseId");
    data.defaultWarehouseId = warehouse.id;
  }
  for (const field of ["salesAccountId", "inventoryAccountId", "cogsAccountId", "purchaseAccountId"] as const) {
    if (data[field] && !await db.accountingAccount.findFirst({ where: { tenantId, id: data[field], active: true, allowsPosting: true } })) {
      throw new ProductInputError("Cuenta contable inválida para este tenant.", field);
    }
  }
  for (const field of ["primaryCode", "barcode"] as const) {
    if (data[field] && await db.lightweightProduct.findFirst({ where: { tenantId, [field]: data[field], ...(existing ? { id: { not: existing.id as string } } : {}) } })) {
      throw new ProductInputError(field === "barcode" ? "No se pudo guardar: el código de barras ya existe." : "No se pudo guardar: el código ya existe.", field, "DUPLICATE_PRODUCT", 409);
    }
  }
  return data;
}

export async function createProduct(tenantId: string, input: Record<string, unknown>, db: ProductClient = getPrismaClient()) {
  const data = await prepareProduct(tenantId, input, db);
  return db.lightweightProduct.create({ data: { tenantId, ...data } });
}

export async function updateProduct(tenantId: string, id: string, input: Record<string, unknown>) {
  const db = getPrismaClient();
  const existing = await db.lightweightProduct.findFirst({ where: { id, tenantId } });
  if (!existing) throw new ProductInputError("Producto no encontrado.", "id", "PRODUCT_NOT_FOUND", 404);
  const data = await prepareProduct(tenantId, input, db, existing);
  return db.lightweightProduct.update({ where: { id, tenantId }, data });
}
