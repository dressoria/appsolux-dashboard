import "@/lib/security/server-only";

import {
  LightweightCustomerIdentificationType,
  LightweightPaymentMethod,
  LightweightPaymentStatus,
  LightweightProductType,
  LightweightProductUnit,
  LightweightSaleStatus,
  Prisma,
} from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { getLimit } from "@/lib/core/plans";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import {
  normalizeCustomerIdentification,
  validateCustomerIdentification,
} from "@/lib/core/customer-fiscal";

export type ProductCatalogInput = {
  tenantId: string;
  name: string;
  type?: LightweightProductType;
  primaryCode: string;
  auxiliaryCode?: string;
  description?: string;
  price: number;
  price2?: number;
  price3?: number;
  cost?: number;
  isActive?: boolean;
  trackInventory?: boolean;
  unit?: LightweightProductUnit;
  categoryId?: string;
  stock?: number;
  minStock?: number;
  barcode?: string;
  expiresAt?: Date;
  taxRate?: number;
  iceEnabled?: boolean;
  iceCode?: string;
  iceRate?: number;
  comboItems?: Array<{ componentProductId: string; quantity: number }>;
};

type UpdateProductInput = Partial<Omit<ProductCatalogInput, "tenantId">> & {
  tenantId: string;
  productId: string;
};

type AdjustStockInput = {
  tenantId: string;
  productId: string;
  quantity: number;
  reason?: string;
};

type CreateCustomerInput = {
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  additionalEmails?: string[];
  address?: string;
  identificationType?: LightweightCustomerIdentificationType | null;
  identification?: string;
  notes?: string;
  isActive?: boolean;
};

type UpdateCustomerInput = Partial<Omit<CreateCustomerInput, "tenantId">> & {
  tenantId: string;
  customerId: string;
};

export type CreateSaleInput = {
  tenantId: string;
  customerId?: string;
  paymentMethod: LightweightPaymentMethod;
  paidAmount?: number;
  items: Array<{
    productId: string;
    quantity: number;
    discountAmount?: number;
  }>;
};

type ListInput = {
  search?: string;
  take?: number;
  type?: LightweightProductType;
  status?: "active" | "inactive";
  categoryId?: string;
  stock?: "low" | "out";
};

type CustomerListInput = {
  search?: string;
  take?: number;
  status?: "active" | "inactive";
  fiscalStatus?: "ready" | "pending";
};

type AddSalePaymentInput = {
  tenantId: string;
  saleId: string;
  method: LightweightPaymentMethod;
  amount: number;
};

function assertPositiveMoney(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} debe ser un numero positivo.`);
  }
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} debe ser un entero mayor a cero.`);
  }
}

async function assertLimitAvailable(
  tenantId: string,
  limitKey: "products" | "customers" | "receipts",
  currentCount: number
) {
  const limit = await getLimit(tenantId, limitKey);

  if (currentCount >= limit) {
    if (limitKey === "products") {
      throw new Error(`Alcanzaste el límite de ${limit} productos de tu plan.`);
    }
    throw new Error(`Alcanzaste el límite de ${limit} registros de tu plan.`);
  }
}

function normalizeSearch(search: string | undefined) {
  return search?.trim() || undefined;
}

function clampTake(take: number | undefined) {
  if (!take || !Number.isFinite(take)) {
    return 50;
  }

  return Math.min(Math.max(Math.floor(take), 1), 50);
}

export async function listProducts(tenantId: string, input: ListInput = {}) {
  const prisma = getPrismaClient();
  const search = normalizeSearch(input.search);

  return prisma.lightweightProduct.findMany({
    where: {
      tenantId,
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { isActive: input.status === "active" } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.stock === "out" ? { trackInventory: true, stock: { lte: 0 } } : {}),
      ...(input.stock === "low" ? { trackInventory: true, stock: { gt: 0 } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
              { primaryCode: { contains: search, mode: "insensitive" } },
              { auxiliaryCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: true,
      comboItems: { include: { componentProduct: true } },
    },
    orderBy: { name: "asc" },
    take: clampTake(input.take),
  });
}

async function validateProductReferences(input: ProductCatalogInput, productId?: string) {
  const prisma = getPrismaClient();
  if (!Object.values(LightweightProductType).includes(input.type ?? "PRODUCT")) throw new Error("El tipo de item no es valido.");
  if (!Object.values(LightweightProductUnit).includes(input.unit ?? "UNIT")) throw new Error("La unidad no es valida.");
  assertPositiveMoney(input.price, "El PVP1");
  if (input.price2 !== undefined) assertPositiveMoney(input.price2, "El PVP2");
  if (input.price3 !== undefined) assertPositiveMoney(input.price3, "El PVP3");
  if (input.cost !== undefined) assertPositiveMoney(input.cost, "El costo");
  if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0)) throw new Error("El stock debe ser un entero mayor o igual a cero.");
  if (input.minStock !== undefined && (!Number.isInteger(input.minStock) || input.minStock < 0)) throw new Error("El stock minimo debe ser un entero mayor o igual a cero.");
  if (![0, 8, 15].includes(input.taxRate ?? 0)) throw new Error("La tarifa de IVA no es valida para el catalogo actual.");
  if (input.iceEnabled) {
    if (!input.iceCode?.trim()) throw new Error("El codigo ICE es requerido cuando aplica ICE.");
    if (input.iceRate === undefined) throw new Error("La tarifa ICE es requerida cuando aplica ICE.");
    assertPositiveMoney(input.iceRate, "La tarifa ICE");
  }
  const primaryCode = input.primaryCode.trim();
  if (!primaryCode) throw new Error("El codigo principal es requerido.");
  const duplicate = await prisma.lightweightProduct.findFirst({
    where: {
      tenantId: input.tenantId,
      ...(productId ? { id: { not: productId } } : {}),
      OR: [
        { primaryCode },
        ...(input.barcode?.trim() ? [{ barcode: input.barcode.trim() }] : []),
      ],
    },
    select: { primaryCode: true, barcode: true },
  });
  if (duplicate?.primaryCode === primaryCode) throw new Error("El codigo principal ya existe.");
  if (duplicate) throw new Error("El codigo de barras ya existe.");
  if (input.categoryId) {
    const category = await prisma.lightweightProductCategory.findFirst({ where: { id: input.categoryId, tenantId: input.tenantId } });
    if (!category) throw new Error("La categoria no pertenece a este negocio.");
  }
  if ((input.type ?? "PRODUCT") === "COMBO") {
    if (!input.comboItems?.length) throw new Error("Agrega al menos un componente al combo.");
    const ids = [...new Set(input.comboItems.map((item) => item.componentProductId))];
    if (ids.length !== input.comboItems.length) throw new Error("No repitas componentes dentro del combo.");
    if (ids.includes(productId ?? "")) throw new Error("Un combo no puede contenerse a si mismo.");
    input.comboItems.forEach((item) => {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("La cantidad de cada componente debe ser un entero mayor a cero.");
    });
    const count = await prisma.lightweightProduct.count({ where: { tenantId: input.tenantId, id: { in: ids }, type: { not: "COMBO" }, isActive: true } });
    if (count !== ids.length) throw new Error("Uno o mas componentes no son validos para este negocio.");
  }
}

export async function createProduct(input: ProductCatalogInput) {
  await requireTenantOperationalAccess(input.tenantId);
  const prisma = getPrismaClient();
  const name = input.name.trim();

  if (!name) {
    throw new Error("El nombre del producto es requerido.");
  }
  await validateProductReferences(input);

  assertPositiveMoney(input.price, "El precio");

  if (input.cost !== undefined) {
    assertPositiveMoney(input.cost, "El costo");
  }

  if (input.stock !== undefined && input.stock < 0) {
    throw new Error("El stock no puede ser negativo.");
  }

  const type = input.type ?? "PRODUCT";
  return prisma.$transaction(async (tx) => {
    const count = await tx.lightweightProduct.count({
      where: { tenantId: input.tenantId },
    });
    await assertLimitAvailable(input.tenantId, "products", count);

    return tx.lightweightProduct.create({
    data: {
      tenantId: input.tenantId,
      name,
      type,
      primaryCode: input.primaryCode.trim(),
      auxiliaryCode: input.auxiliaryCode?.trim() || undefined,
      description: input.description?.trim() || undefined,
      price: new Prisma.Decimal(input.price),
      price2: input.price2 === undefined ? undefined : new Prisma.Decimal(input.price2),
      price3: input.price3 === undefined ? undefined : new Prisma.Decimal(input.price3),
      cost:
        input.cost === undefined ? undefined : new Prisma.Decimal(input.cost),
      isActive: input.isActive ?? true,
      trackInventory: type === "PRODUCT" ? input.trackInventory ?? true : false,
      unit: input.unit ?? (type === "SERVICE" ? "SERVICE" : "UNIT"),
      categoryId: input.categoryId || undefined,
      stock: type === "PRODUCT" && (input.trackInventory ?? true) ? input.stock ?? 0 : 0,
      minStock: input.minStock,
      barcode: input.barcode?.trim() || undefined,
      expiresAt: input.expiresAt,
      taxRate: new Prisma.Decimal(input.taxRate ?? 0),
      iceEnabled: input.iceEnabled ?? false,
      iceCode: input.iceEnabled ? input.iceCode?.trim() || undefined : undefined,
      iceRate: input.iceEnabled && input.iceRate !== undefined ? new Prisma.Decimal(input.iceRate) : undefined,
      comboItems: type === "COMBO" ? { create: input.comboItems!.map((item) => ({ componentProductId: item.componentProductId, quantity: item.quantity })) } : undefined,
    },
    include: { category: true, comboItems: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateProduct(input: UpdateProductInput) {
  await requireTenantOperationalAccess(input.tenantId);
  const prisma = getPrismaClient();
  const existing = await prisma.lightweightProduct.findFirst({
    where: {
      id: input.productId,
      tenantId: input.tenantId,
    },
    include: { comboItems: true },
  });

  if (!existing) {
    throw new Error("Producto no encontrado.");
  }

  const merged: ProductCatalogInput = {
    ...input,
    tenantId: input.tenantId,
    name: input.name ?? existing.name,
    type: input.type ?? existing.type,
    primaryCode: input.primaryCode ?? existing.primaryCode ?? "",
    price: input.price ?? Number(existing.price),
    price2: input.price2 ?? (existing.price2 === null ? undefined : Number(existing.price2)),
    price3: input.price3 ?? (existing.price3 === null ? undefined : Number(existing.price3)),
    cost: input.cost ?? (existing.cost === null ? undefined : Number(existing.cost)),
    stock: input.stock ?? existing.stock,
    minStock: input.minStock ?? existing.minStock ?? undefined,
    taxRate: input.taxRate ?? Number(existing.taxRate),
    unit: input.unit ?? existing.unit,
    iceEnabled: input.iceEnabled ?? existing.iceEnabled,
    iceCode: input.iceCode ?? existing.iceCode ?? undefined,
    iceRate: input.iceRate ?? (existing.iceRate === null ? undefined : Number(existing.iceRate)),
    comboItems: input.comboItems ?? existing.comboItems.map((item) => ({ componentProductId: item.componentProductId, quantity: item.quantity })),
  };
  await validateProductReferences(merged, input.productId);

  const data: Prisma.LightweightProductUpdateInput = {};

  if (input.type !== undefined) data.type = input.type;
  if (input.primaryCode !== undefined) data.primaryCode = input.primaryCode.trim();
  if (input.auxiliaryCode !== undefined) data.auxiliaryCode = input.auxiliaryCode.trim() || null;
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.unit !== undefined) data.unit = input.unit;
  if (input.categoryId !== undefined) data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      throw new Error("El nombre del producto es requerido.");
    }

    data.name = name;
  }

  if (input.price !== undefined) {
    assertPositiveMoney(input.price, "El precio");
    data.price = new Prisma.Decimal(input.price);
  }

  if (input.cost !== undefined) {
    assertPositiveMoney(input.cost, "El costo");
    data.cost = new Prisma.Decimal(input.cost);
  }
  if (input.price2 !== undefined) data.price2 = new Prisma.Decimal(input.price2);
  if (input.price3 !== undefined) data.price3 = new Prisma.Decimal(input.price3);

  if (input.minStock !== undefined) {
    if (input.minStock < 0) {
      throw new Error("El stock minimo no puede ser negativo.");
    }

    data.minStock = input.minStock;
  }

  if (input.barcode !== undefined) {
    data.barcode = input.barcode.trim() || null;
  }

  if (input.expiresAt !== undefined) {
    data.expiresAt = input.expiresAt;
  }

  if (input.taxRate !== undefined) {
    assertPositiveMoney(input.taxRate, "La tasa de IVA");
    data.taxRate = new Prisma.Decimal(input.taxRate);
  }

  if (input.iceEnabled !== undefined) data.iceEnabled = input.iceEnabled;
  if (input.iceCode !== undefined) data.iceCode = input.iceCode.trim() || null;
  if (input.iceRate !== undefined) data.iceRate = new Prisma.Decimal(input.iceRate);
  const finalType = input.type ?? existing.type;
  data.trackInventory = finalType === "PRODUCT" ? input.trackInventory ?? existing.trackInventory : false;
  if (finalType !== "PRODUCT") data.stock = 0;
  if (finalType === "COMBO" && input.comboItems) {
    data.comboItems = { deleteMany: {}, create: input.comboItems.map((item) => ({ componentProductId: item.componentProductId, quantity: item.quantity })) };
  } else if (finalType !== "COMBO") {
    data.comboItems = { deleteMany: {} };
  }

  return prisma.lightweightProduct.update({
    where: { id: input.productId },
    data,
    include: { category: true, comboItems: true },
  });
}

export async function adjustProductStock(input: AdjustStockInput) {
  await requireTenantOperationalAccess(input.tenantId);
  assertPositiveInteger(Math.abs(input.quantity), "El ajuste");

  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const product = await tx.lightweightProduct.findFirst({
      where: {
        id: input.productId,
        tenantId: input.tenantId,
      },
    });

    if (!product) {
      throw new Error("Producto no encontrado.");
    }

    const nextStock = product.stock + input.quantity;

    if (nextStock < 0) {
      throw new Error("El ajuste dejaria stock negativo.");
    }

    const updated = await tx.lightweightProduct.update({
      where: { id: product.id },
      data: { stock: nextStock },
    });

    await tx.lightweightStockMovement.create({
      data: {
        tenantId: input.tenantId,
        productId: product.id,
        type: "adjustment",
        quantity: input.quantity,
      },
    });

    return updated;
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeCustomerEmails(primary: string | undefined, additional: string[] | undefined) {
  const emails = [primary, ...(additional ?? [])]
    .map((email) => email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
  if (emails.length > 5) throw new Error("Puedes registrar un maximo de 5 correos.");
  if (new Set(emails).size !== emails.length) throw new Error("No repitas correos dentro del mismo cliente.");
  if (emails.some((email) => !EMAIL_PATTERN.test(email))) throw new Error("Uno o mas correos no tienen un formato valido.");
  return emails;
}

async function validateCustomerFiscalInput(
  tenantId: string,
  type: LightweightCustomerIdentificationType | null | undefined,
  value: string | undefined,
  customerId?: string
) {
  if (!type && !value?.trim()) return null;
  if (!type || !value?.trim()) throw new Error("Completa el tipo y la identificacion fiscal.");
  const identification = validateCustomerIdentification(type, value);
  const duplicate = await getPrismaClient().lightweightCustomer.findFirst({
    where: { tenantId, identification, ...(customerId ? { id: { not: customerId } } : {}) },
    select: { id: true },
  });
  if (duplicate) throw new Error("Ya existe un cliente con esta identificacion.");
  return normalizeCustomerIdentification(type, identification);
}

export async function listCustomers(tenantId: string, input: CustomerListInput = {}) {
  const prisma = getPrismaClient();
  const search = normalizeSearch(input.search);

  return prisma.lightweightCustomer.findMany({
    where: {
      tenantId,
      ...(input.status ? { isActive: input.status === "active" } : {}),
      ...(input.fiscalStatus === "ready" ? { identificationType: { not: null }, identification: { not: null } } : {}),
      ...(input.fiscalStatus === "pending" ? { NOT: { identificationType: { not: null }, identification: { not: null } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { identification: { contains: search, mode: "insensitive" } },
              { additionalEmails: { has: search.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: clampTake(input.take),
  });
}

export async function createCustomer(input: CreateCustomerInput) {
  await requireTenantOperationalAccess(input.tenantId);
  const prisma = getPrismaClient();
  const name = input.name.trim();

  if (!name) {
    throw new Error("El nombre del cliente es requerido.");
  }

  const emails = normalizeCustomerEmails(input.email, input.additionalEmails);
  const identification = await validateCustomerFiscalInput(input.tenantId, input.identificationType, input.identification);

  const count = await prisma.lightweightCustomer.count({
    where: { tenantId: input.tenantId },
  });
  await assertLimitAvailable(input.tenantId, "customers", count);

  return prisma.lightweightCustomer.create({
    data: {
      tenantId: input.tenantId,
      name,
      phone: input.phone?.trim() || undefined,
      email: emails[0],
      additionalEmails: emails.slice(1),
      address: input.address?.trim() || undefined,
      identificationType: input.identificationType ?? undefined,
      identification,
      notes: input.notes?.trim() || undefined,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateCustomer(input: UpdateCustomerInput) {
  await requireTenantOperationalAccess(input.tenantId);
  const prisma = getPrismaClient();
  const existing = await prisma.lightweightCustomer.findFirst({
    where: {
      id: input.customerId,
      tenantId: input.tenantId,
    },
    select: { id: true, identificationType: true, identification: true, email: true, additionalEmails: true },
  });

  if (!existing) {
    throw new Error("Cliente no encontrado.");
  }

  const data: Prisma.LightweightCustomerUpdateInput = {};

  if (input.identificationType !== undefined || input.identification !== undefined) {
    const type = input.identificationType === undefined ? existing.identificationType : input.identificationType;
    data.identificationType = type;
    data.identification = await validateCustomerFiscalInput(input.tenantId, type, input.identification ?? existing.identification ?? undefined, input.customerId);
  }

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      throw new Error("El nombre del cliente es requerido.");
    }

    data.name = name;
  }

  if (input.phone !== undefined) {
    data.phone = input.phone.trim() || null;
  }

  if (input.email !== undefined || input.additionalEmails !== undefined) {
    const emails = normalizeCustomerEmails(input.email ?? existing.email ?? undefined, input.additionalEmails ?? existing.additionalEmails);
    data.email = emails[0] ?? null;
    data.additionalEmails = emails.slice(1);
  }

  if (input.address !== undefined) {
    data.address = input.address.trim() || null;
  }
  if (input.notes !== undefined) data.notes = input.notes.trim() || null;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.lightweightCustomer.update({
    where: { id: input.customerId },
    data,
  });
}

function buildSalesWhere(
  tenantId: string,
  input: { status?: "all" | "paid" | "pending" | "canceled"; customerId?: string }
): Prisma.LightweightSaleWhereInput {
  const status = input.status ?? "all";
  return {
    tenantId,
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(status === "paid" ? { paymentStatus: "paid" } : {}),
    ...(status === "pending"
      ? {
          status: { not: "canceled" as LightweightSaleStatus },
          paymentStatus: { in: ["pending", "partial"] as LightweightPaymentStatus[] },
        }
      : {}),
    ...(status === "canceled" ? { status: "canceled" } : {}),
  };
}

export async function countSales(
  tenantId: string,
  input: { status?: "all" | "paid" | "pending" | "canceled"; customerId?: string } = {}
): Promise<number> {
  const prisma = getPrismaClient();
  return prisma.lightweightSale.count({ where: buildSalesWhere(tenantId, input) });
}

export async function countActiveSales(tenantId: string): Promise<number> {
  const prisma = getPrismaClient();
  return prisma.lightweightSale.count({
    where: { tenantId, status: { not: "canceled" } },
  });
}

export async function listSales(
  tenantId: string,
  input: {
    status?: "all" | "paid" | "pending" | "canceled";
    customerId?: string;
    page?: number;
    perPage?: number;
  } = {}
) {
  const prisma = getPrismaClient();
  const perPage = Math.min(input.perPage ?? 20, 50);
  const page = Math.max(input.page ?? 1, 1);

  return prisma.lightweightSale.findMany({
    where: buildSalesWhere(tenantId, input),
    include: {
      customer: true,
      items: {
        include: { product: true },
      },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });
}

export async function getSaleById(tenantId: string, saleId: string) {
  const prisma = getPrismaClient();

  return prisma.lightweightSale.findFirst({
    where: {
      id: saleId,
      tenantId,
    },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
      payments: true,
      tenant: true,
    },
  });
}

function resolvePaymentStatus(
  total: Prisma.Decimal,
  paidAmount: Prisma.Decimal
): LightweightPaymentStatus {
  if (paidAmount.equals(0)) {
    return "pending";
  }

  if (paidAmount.lessThan(total)) {
    return "partial";
  }

  return "paid";
}

function resolveSaleStatus(
  paymentStatus: LightweightPaymentStatus
): LightweightSaleStatus {
  return paymentStatus === "paid" ? "paid" : "open";
}

export async function createSale(input: CreateSaleInput) {
  await requireTenantOperationalAccess(input.tenantId);
  const prisma = getPrismaClient();

  if (input.items.length === 0) {
    throw new Error("La venta debe tener al menos un item.");
  }

  for (const item of input.items) {
    assertPositiveInteger(item.quantity, "La cantidad");
  }

  const saleCount = await prisma.lightweightSale.count({
    where: {
      tenantId: input.tenantId,
      status: { not: "canceled" },
    },
  });
  await assertLimitAvailable(input.tenantId, "receipts", saleCount);

  return prisma.$transaction(async (tx) => {
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await tx.lightweightProduct.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: productIds },
        isActive: true,
      },
      include: { comboItems: { include: { componentProduct: true } } },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    if (products.length !== productIds.length) {
      throw new Error("Uno o mas productos no pertenecen a este tenant.");
    }

    if (input.customerId) {
      const customer = await tx.lightweightCustomer.findFirst({
        where: {
          id: input.customerId,
          tenantId: input.tenantId,
        },
        select: { id: true },
      });

      if (!customer) {
        throw new Error("El cliente no pertenece a este tenant.");
      }
    }

    let subtotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);

    const saleItems = input.items.map((item) => {
      const product = productById.get(item.productId);

      if (!product) {
        throw new Error("Producto no encontrado.");
      }

      if (product.type === "PRODUCT" && product.trackInventory && product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }

      if (product.type === "COMBO") {
        for (const comboItem of product.comboItems) {
          const required = Number(comboItem.quantity) * item.quantity;
          if (comboItem.componentProduct.trackInventory && comboItem.componentProduct.stock < required) {
            throw new Error(`Stock insuficiente para ${comboItem.componentProduct.name}, componente de ${product.name}.`);
          }
        }
      }

      const grossAmount = product.price.mul(item.quantity);
      const discountAmount = new Prisma.Decimal(
        Math.max(0, Math.min(item.discountAmount ?? 0, Number(grossAmount)))
      );
      const lineSubtotal = grossAmount.sub(discountAmount);
      const taxRate = product.taxRate;
      const taxAmount = lineSubtotal.mul(taxRate).div(100).toDecimalPlaces(2);
      const lineTotal = lineSubtotal.add(taxAmount);

      subtotal = subtotal.add(lineSubtotal);
      taxTotal = taxTotal.add(taxAmount);
      discountTotal = discountTotal.add(discountAmount);

      return {
        product,
        quantity: item.quantity,
        price: product.price,
        discountAmount,
        taxRate,
        taxAmount,
        total: lineTotal,
      };
    });

    const total = subtotal.add(taxTotal);

    const requestedPaidAmount =
      input.paymentMethod === "credit" ? 0 : input.paidAmount ?? Number(total);
    assertPositiveMoney(requestedPaidAmount, "El pago");

    const paidAmount = Prisma.Decimal.min(
      new Prisma.Decimal(requestedPaidAmount),
      total
    );
    const paymentStatus = resolvePaymentStatus(total, paidAmount);
    const status = resolveSaleStatus(paymentStatus);
    const balanceImpact = total.sub(paidAmount);

    if (balanceImpact.greaterThan(0) && !input.customerId) {
      throw new Error("Las ventas fiadas requieren un cliente.");
    }

    const sale = await tx.lightweightSale.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        status,
        subtotal,
        taxTotal,
        discountTotal,
        total,
        paymentStatus,
        items: {
          create: saleItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.price,
            discountAmount: item.discountAmount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            total: item.total,
          })),
        },
        payments: {
          create: {
            method: input.paymentMethod,
            amount: paidAmount,
          },
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    const inventoryDemand = new Map<string, number>();
    for (const item of saleItems) {
      if (item.product.type === "PRODUCT" && item.product.trackInventory) {
        inventoryDemand.set(item.product.id, (inventoryDemand.get(item.product.id) ?? 0) + item.quantity);
      }
      if (item.product.type === "COMBO") {
        for (const component of item.product.comboItems) {
          if (component.componentProduct.trackInventory) {
            inventoryDemand.set(component.componentProductId, (inventoryDemand.get(component.componentProductId) ?? 0) + Number(component.quantity) * item.quantity);
          }
        }
      }
    }

    const inventoryProducts = await tx.lightweightProduct.findMany({
      where: { tenantId: input.tenantId, id: { in: [...inventoryDemand.keys()] } },
      select: { id: true, name: true, stock: true },
    });
    for (const product of inventoryProducts) {
      if (product.stock < (inventoryDemand.get(product.id) ?? 0)) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }
    }

    for (const [productId, quantity] of inventoryDemand) {
      await tx.lightweightProduct.update({
        where: { id: productId },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      });
      await tx.lightweightStockMovement.create({
        data: {
          tenantId: input.tenantId,
          productId,
          type: "sale",
          quantity: -quantity,
        },
      });
    }

    if (input.customerId && balanceImpact.greaterThan(0)) {
      await tx.lightweightCustomer.update({
        where: { id: input.customerId },
        data: {
          balance: {
            increment: balanceImpact,
          },
        },
      });
    }

    return sale;
  });
}

export async function cancelSale(tenantId: string, saleId: string) {
  await requireTenantOperationalAccess(tenantId);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const sale = await tx.lightweightSale.findFirst({
      where: {
        id: saleId,
        tenantId,
      },
      include: {
        items: { include: { product: { include: { comboItems: { include: { componentProduct: true } } } } } },
        payments: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    if (sale.status === "canceled") {
      throw new Error("La venta ya esta cancelada.");
    }

    const paidAmount = sale.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0)
    );
    const balanceImpact = sale.total.sub(paidAmount);

    const inventoryRestore = new Map<string, number>();
    for (const item of sale.items) {
      if (item.product.type === "PRODUCT" && item.product.trackInventory) {
        inventoryRestore.set(item.productId, (inventoryRestore.get(item.productId) ?? 0) + item.quantity);
      }
      if (item.product.type === "COMBO") {
        for (const component of item.product.comboItems) {
          if (component.componentProduct.trackInventory) {
            inventoryRestore.set(component.componentProductId, (inventoryRestore.get(component.componentProductId) ?? 0) + component.quantity * item.quantity);
          }
        }
      }
    }

    for (const [productId, quantity] of inventoryRestore) {
      await tx.lightweightProduct.update({
        where: { id: productId },
        data: {
          stock: {
            increment: quantity,
          },
        },
      });
      await tx.lightweightStockMovement.create({
        data: {
          tenantId,
          productId,
          type: "adjustment",
          quantity,
        },
      });
    }

    if (sale.customerId && balanceImpact.greaterThan(0)) {
      await tx.lightweightCustomer.update({
        where: { id: sale.customerId },
        data: {
          balance: {
            decrement: balanceImpact,
          },
        },
      });
    }

    return tx.lightweightSale.update({
      where: { id: sale.id },
      data: {
        status: "canceled",
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });
  });
}

export async function addSalePayment(input: AddSalePaymentInput) {
  await requireTenantOperationalAccess(input.tenantId);
  assertPositiveMoney(input.amount, "El abono");

  if (input.amount <= 0) {
    throw new Error("El abono debe ser mayor a cero.");
  }

  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const sale = await tx.lightweightSale.findFirst({
      where: {
        id: input.saleId,
        tenantId: input.tenantId,
      },
      include: {
        payments: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    if (sale.status === "canceled") {
      throw new Error("No se puede abonar una venta cancelada.");
    }

    const paidAmount = sale.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0)
    );
    const pending = sale.total.sub(paidAmount);

    if (pending.lessThanOrEqualTo(0)) {
      throw new Error("La venta ya esta pagada.");
    }

    const paymentAmount = Prisma.Decimal.min(
      new Prisma.Decimal(input.amount),
      pending
    );
    const nextPaid = paidAmount.add(paymentAmount);
    const paymentStatus = resolvePaymentStatus(sale.total, nextPaid);
    const status = resolveSaleStatus(paymentStatus);

    await tx.lightweightPayment.create({
      data: {
        saleId: sale.id,
        method: input.method,
        amount: paymentAmount,
      },
    });

    if (sale.customerId) {
      await tx.lightweightCustomer.update({
        where: { id: sale.customerId },
        data: {
          balance: {
            decrement: paymentAmount,
          },
        },
      });
    }

    return tx.lightweightSale.update({
      where: { id: sale.id },
      data: {
        paymentStatus,
        status,
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });
  });
}

export async function getCustomerDetail(tenantId: string, customerId: string) {
  const prisma = getPrismaClient();

  const customer = await prisma.lightweightCustomer.findFirst({
    where: { id: customerId, tenantId },
  });

  if (!customer) return null;

  const [aggregate, recentSales] = await Promise.all([
    prisma.lightweightSale.aggregate({
      where: { tenantId, customerId, status: { not: "canceled" } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.lightweightSale.findMany({
      where: { tenantId, customerId },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const activeSales = recentSales.filter((s) => s.status !== "canceled");
  const lastSaleAt = activeSales[0]?.createdAt ?? null;

  return {
    customer,
    summary: {
      totalSales: aggregate._count.id,
      totalPurchased: aggregate._sum.total ?? new Prisma.Decimal(0),
      pendingBalance: customer.balance,
      lastSaleAt,
    },
    recentSales,
  };
}

export async function getBasicReports(tenantId: string) {
  const prisma = getPrismaClient();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    products,
    productCount,
    customerCount,
    saleCount,
    sales,
    monthSales,
    pendingCustomers,
    topItems,
  ] = await Promise.all([
    prisma.lightweightProduct.findMany({
      where: { tenantId },
      orderBy: { stock: "asc" },
    }),
    prisma.lightweightProduct.count({ where: { tenantId } }),
    prisma.lightweightCustomer.count({ where: { tenantId } }),
    prisma.lightweightSale.count({
      where: { tenantId, status: { not: "canceled" } },
    }),
    prisma.lightweightSale.findMany({
      where: {
        tenantId,
        status: { not: "canceled" },
        createdAt: { gte: startOfDay },
      },
      include: { payments: true },
    }),
    prisma.lightweightSale.findMany({
      where: {
        tenantId,
        status: { not: "canceled" },
        createdAt: { gte: startOfMonth },
      },
      include: { payments: true },
    }),
    prisma.lightweightCustomer.findMany({
      where: {
        tenantId,
        balance: { gt: 0 },
      },
      orderBy: { balance: "desc" },
      take: 10,
    }),
    prisma.lightweightSaleItem.findMany({
      where: {
        sale: {
          tenantId,
          status: { not: "canceled" },
          createdAt: { gte: startOfMonth },
        },
      },
      include: {
        product: true,
      },
      take: 200,
    }),
  ]);

  const sumSales = (rows: typeof sales) =>
    rows.reduce((sum, sale) => sum.add(sale.total), new Prisma.Decimal(0));
  const sumPaid = (rows: typeof sales) =>
    rows.reduce(
      (sum, sale) =>
        sum.add(
          sale.payments.reduce(
            (paymentSum, payment) => paymentSum.add(payment.amount),
            new Prisma.Decimal(0)
          )
        ),
      new Prisma.Decimal(0)
    );

  const monthTotal = sumSales(monthSales);
  const monthPaid = sumPaid(monthSales);
  const paymentsByMethod = monthSales.reduce<Record<string, Prisma.Decimal>>(
    (accumulator, sale) => {
      for (const payment of sale.payments) {
        accumulator[payment.method] = (
          accumulator[payment.method] ?? new Prisma.Decimal(0)
        ).add(payment.amount);
      }

      return accumulator;
    },
    {}
  );
  const topProductsMap = new Map<
    string,
    { name: string; quantity: number; total: Prisma.Decimal }
  >();

  for (const item of topItems) {
    const current = topProductsMap.get(item.productId) ?? {
      name: item.product.name,
      quantity: 0,
      total: new Prisma.Decimal(0),
    };
    current.quantity += item.quantity;
    current.total = current.total.add(item.total);
    topProductsMap.set(item.productId, current);
  }

  return {
    salesToday: sumSales(sales),
    salesMonth: monthTotal,
    collectedMonth: monthPaid,
    pendingMonth: monthTotal.sub(monthPaid),
    paymentsByMethod,
    topProducts: [...topProductsMap.values()]
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 5),
    pendingCustomers,
    lowStockProducts: products.filter(
      (product) =>
        product.stock > 0 &&
        product.minStock !== null &&
        product.stock <= product.minStock
    ),
    outOfStockProducts: products.filter((product) => product.stock <= 0),
    counts: {
      products: productCount,
      customers: customerCount,
      receipts: saleCount,
    },
  };
}

export async function listStockMovements(
  tenantId: string,
  input: {
    productId?: string;
    type?: "sale" | "adjustment";
    take?: number;
  } = {}
) {
  const prisma = getPrismaClient();

  return prisma.lightweightStockMovement.findMany({
    where: {
      tenantId,
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.type ? { type: input.type } : {}),
    },
    include: {
      product: true,
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(input.take),
  });
}

export async function getBasicUsageCounts(tenantId: string) {
  const prisma = getPrismaClient();
  const [products, customers, receipts] = await Promise.all([
    prisma.lightweightProduct.count({ where: { tenantId } }),
    prisma.lightweightCustomer.count({ where: { tenantId } }),
    prisma.lightweightSale.count({
      where: {
        tenantId,
        status: { not: "canceled" },
      },
    }),
  ]);

  return { products, customers, receipts };
}

export async function getDailyCashSummary(tenantId: string) {
  const prisma = getPrismaClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [salesToday, paymentsToday, canceledSales] = await Promise.all([
    prisma.lightweightSale.findMany({
      where: {
        tenantId,
        createdAt: { gte: startOfDay },
        status: { not: "canceled" },
      },
      include: { payments: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.lightweightPayment.findMany({
      where: {
        createdAt: { gte: startOfDay },
        sale: {
          tenantId,
          status: { not: "canceled" },
        },
      },
      include: {
        sale: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.lightweightSale.count({
      where: {
        tenantId,
        createdAt: { gte: startOfDay },
        status: "canceled",
      },
    }),
  ]);

  const byMethod = paymentsToday.reduce<Record<string, Prisma.Decimal>>(
    (accumulator, payment) => {
      accumulator[payment.method] = (
        accumulator[payment.method] ?? new Prisma.Decimal(0)
      ).add(payment.amount);

      return accumulator;
    },
    {}
  );
  const totalSales = salesToday.reduce(
    (sum, sale) => sum.add(sale.total),
    new Prisma.Decimal(0)
  );
  const totalCollected = paymentsToday.reduce(
    (sum, payment) => sum.add(payment.amount),
    new Prisma.Decimal(0)
  );

  return {
    salesToday,
    paymentsToday,
    canceledSales,
    totalSales,
    totalCollected,
    creditGenerated: totalSales.sub(totalCollected),
    byMethod,
    estimatedNet: totalCollected,
  };
}
