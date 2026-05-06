import "@/lib/security/server-only";

import {
  LightweightPaymentMethod,
  LightweightPaymentStatus,
  LightweightSaleStatus,
  Prisma,
} from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { getLimit } from "@/lib/core/plans";

type CreateProductInput = {
  tenantId: string;
  name: string;
  price: number;
  cost?: number;
  stock?: number;
  minStock?: number;
  barcode?: string;
  expiresAt?: Date;
};

type CreateCustomerInput = {
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
};

export type CreateSaleInput = {
  tenantId: string;
  customerId?: string;
  paymentMethod: LightweightPaymentMethod;
  paidAmount?: number;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
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
    throw new Error(`Limite del plan alcanzado para ${limitKey}: ${limit}.`);
  }
}

export async function listProducts(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.lightweightProduct.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createProduct(input: CreateProductInput) {
  const prisma = getPrismaClient();
  const name = input.name.trim();

  if (!name) {
    throw new Error("El nombre del producto es requerido.");
  }

  assertPositiveMoney(input.price, "El precio");

  if (input.cost !== undefined) {
    assertPositiveMoney(input.cost, "El costo");
  }

  if (input.stock !== undefined && input.stock < 0) {
    throw new Error("El stock no puede ser negativo.");
  }

  const count = await prisma.lightweightProduct.count({
    where: { tenantId: input.tenantId },
  });
  await assertLimitAvailable(input.tenantId, "products", count);

  return prisma.lightweightProduct.create({
    data: {
      tenantId: input.tenantId,
      name,
      price: new Prisma.Decimal(input.price),
      cost:
        input.cost === undefined ? undefined : new Prisma.Decimal(input.cost),
      stock: input.stock ?? 0,
      minStock: input.minStock,
      barcode: input.barcode?.trim() || undefined,
      expiresAt: input.expiresAt,
    },
  });
}

export async function listCustomers(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.lightweightCustomer.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCustomer(input: CreateCustomerInput) {
  const prisma = getPrismaClient();
  const name = input.name.trim();

  if (!name) {
    throw new Error("El nombre del cliente es requerido.");
  }

  const count = await prisma.lightweightCustomer.count({
    where: { tenantId: input.tenantId },
  });
  await assertLimitAvailable(input.tenantId, "customers", count);

  return prisma.lightweightCustomer.create({
    data: {
      tenantId: input.tenantId,
      name,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
    },
  });
}

export async function listSales(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.lightweightSale.findMany({
    where: { tenantId },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
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
      },
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

    let total = new Prisma.Decimal(0);
    const saleItems = input.items.map((item) => {
      const product = productById.get(item.productId);

      if (!product) {
        throw new Error("Producto no encontrado.");
      }

      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}.`);
      }

      const itemTotal = product.price.mul(item.quantity);
      total = total.add(itemTotal);

      return {
        product,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
      };
    });

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
        total,
        paymentStatus,
        items: {
          create: saleItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.price,
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

    for (const item of saleItems) {
      await tx.lightweightProduct.update({
        where: { id: item.product.id },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
      await tx.lightweightStockMovement.create({
        data: {
          tenantId: input.tenantId,
          productId: item.product.id,
          type: "sale",
          quantity: -item.quantity,
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
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const sale = await tx.lightweightSale.findFirst({
      where: {
        id: saleId,
        tenantId,
      },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    if (sale.status === "canceled") {
      return sale;
    }

    const paidAmount = sale.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0)
    );
    const balanceImpact = sale.total.sub(paidAmount);

    for (const item of sale.items) {
      await tx.lightweightProduct.update({
        where: { id: item.productId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
      await tx.lightweightStockMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          type: "adjustment",
          quantity: item.quantity,
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
