import { prepareTreasuryIntegration, integratePurchase, cancelTreasurySource } from "@/lib/core/treasury/integration";
import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type {
  PurchaseDocumentType,
  PurchaseDocumentStatus,
  PurchaseDocumentOrigin,
  DeductibilityStatus,
} from "@prisma/client";

export type CreatePurchaseDocumentInput = {
  tenantId: string;
  createdByUserId: string;
  treasuryAccountId?: string;
  supplierId?: string | null;
  documentType?: PurchaseDocumentType;
  supplierDocumentNumber?: string | null;
  accessKey?: string | null;
  authorizationNumber?: string | null;
  issueDate?: Date | null;
  authorizationDate?: Date | null;
  subtotal0?: number;
  subtotal15?: number;
  subtotalNoTax?: number;
  subtotalExempt?: number;
  discountTotal?: number;
  iceTotal?: number;
  ivaTotal?: number;
  total?: number;
  paymentMethod?: string | null;
  paymentTermDays?: number | null;
  dueDate?: Date | null;
  status?: PurchaseDocumentStatus;
  origin?: PurchaseDocumentOrigin;
  accountingCategoryId?: string | null;
  supplierName?: string | null;
  supplierIdentification?: string | null;
  notes?: string | null;
  items?: Array<{
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRate?: number;
  }>;
  payments?: Array<{
    method: string;
    amount: number;
    notes?: string | null;
  }>;
};

function computeLineAmounts(item: {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
}) {
  const subtotal =
    item.quantity * item.unitPrice - (item.discountAmount ?? 0);
  const taxRate = item.taxRate ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export async function createPurchaseDocument(input: CreatePurchaseDocumentInput) {
  const prisma = getPrismaClient();

  if (input.accessKey) {
    const existing = await prisma.purchaseDocument.findFirst({
      where: { tenantId: input.tenantId, accessKey: input.accessKey },
      select: { id: true },
    });
    if (existing) {
      throw new Error("DUPLICATE_ACCESS_KEY: Este documento ya está registrado.");
    }
  }

  const itemsData = (input.items ?? []).map((item) => {
    const { subtotal, taxAmount, total } = computeLineAmounts(item);
    return {
      productId: item.productId ?? undefined,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount ?? 0,
      subtotal,
      taxRate: item.taxRate ?? 0,
      taxAmount,
      total,
    };
  });

  const treasury = (input.origin ?? "MANUAL") === "MANUAL" ? await prepareTreasuryIntegration(input.tenantId, input.createdByUserId, input.treasuryAccountId) : null;
  return prisma.$transaction(async (tx) => {
  const document = await tx.purchaseDocument.create({
    data: {
      tenantId: input.tenantId,
      createdByUserId: input.createdByUserId,
      supplierId: input.supplierId ?? undefined,
      documentType: input.documentType ?? "INVOICE",
      supplierDocumentNumber: input.supplierDocumentNumber,
      accessKey: input.accessKey,
      authorizationNumber: input.authorizationNumber,
      issueDate: input.issueDate,
      authorizationDate: input.authorizationDate,
      subtotal0: input.subtotal0 ?? 0,
      subtotal15: input.subtotal15 ?? 0,
      subtotalNoTax: input.subtotalNoTax ?? 0,
      subtotalExempt: input.subtotalExempt ?? 0,
      discountTotal: input.discountTotal ?? 0,
      iceTotal: input.iceTotal ?? 0,
      ivaTotal: input.ivaTotal ?? 0,
      total: input.total ?? 0,
      paymentMethod: input.paymentMethod,
      paymentTermDays: input.paymentTermDays,
      dueDate: input.dueDate,
      status: input.status ?? "REGISTERED",
      origin: input.origin ?? "MANUAL",
      accountingCategoryId: input.accountingCategoryId ?? undefined,
      supplierName: input.supplierName,
      supplierIdentification: input.supplierIdentification,
      notes: input.notes,
      items: itemsData.length > 0 ? { create: itemsData } : undefined,
      payments:
        input.payments && input.payments.length > 0
          ? { create: input.payments }
          : undefined,
    },
    include: { items: true, payments: true, supplier: true },
  });
  if (treasury) await integratePurchase(tx, treasury, document.id);
  return document;
  });
}

export async function listPurchaseDocuments(
  tenantId: string,
  options: {
    q?: string;
    from?: string;
    to?: string;
    documentType?: string;
    status?: string;
    origin?: string;
    categoryId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const prisma = getPrismaClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;

  const where: Record<string, unknown> = { tenantId };

  if (options.q) {
    where.OR = [
      { supplierName: { contains: options.q, mode: "insensitive" } },
      { supplierIdentification: { contains: options.q, mode: "insensitive" } },
      { supplierDocumentNumber: { contains: options.q, mode: "insensitive" } },
      { accessKey: { contains: options.q, mode: "insensitive" } },
    ];
  }
  if (options.from || options.to) {
    where.issueDate = {
      ...(options.from ? { gte: new Date(options.from) } : {}),
      ...(options.to ? { lte: new Date(options.to + "T23:59:59.999Z") } : {}),
    };
  }
  if (options.documentType) where.documentType = options.documentType;
  if (options.status) where.status = options.status;
  if (options.origin) where.origin = options.origin;
  if (options.categoryId) where.accountingCategoryId = options.categoryId;

  const [items, total] = await Promise.all([
    prisma.purchaseDocument.findMany({
      where: where as never,
      include: {
        supplier: { select: { name: true, identification: true } },
        accountingCategory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseDocument.count({ where: where as never }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPurchaseDocumentById(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseDocument.findFirst({
    where: { id, tenantId },
    include: {
      supplier: true,
      items: { include: { product: { select: { name: true, primaryCode: true } } } },
      payments: true,
      accountingCategory: true,
      receipts: { select: { id: true, status: true, receivedAt: true } },
    },
  });
}

export async function updatePurchaseDocumentDeductibility(
  tenantId: string,
  id: string,
  status: DeductibilityStatus,
  reason?: string | null,
) {
  const prisma = getPrismaClient();
  return prisma.purchaseDocument.updateMany({
    where: { id, tenantId },
    data: { deductibilityStatus: status, deductibilityReason: reason },
  });
}

export async function updatePurchaseDocumentCategory(
  tenantId: string,
  id: string,
  categoryId: string | null,
) {
  const prisma = getPrismaClient();
  return prisma.purchaseDocument.updateMany({
    where: { id, tenantId },
    data: { accountingCategoryId: categoryId },
  });
}

export async function cancelPurchaseDocument(tenantId: string, id: string) {
  const prisma = getPrismaClient();
  const treasury = await prepareTreasuryIntegration(tenantId);
  return prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT "id" FROM "PurchaseDocument" WHERE "id"=${id} AND "tenantId"=${tenantId} FOR UPDATE`;
  if (treasury) await cancelTreasurySource(tx, treasury, "PURCHASE", id);
  return tx.purchaseDocument.updateMany({
    where: { id, tenantId, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED" },
  });
  });
}

export async function listAccountingCategories(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseAccountingCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createAccountingCategory(tenantId: string, name: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseAccountingCategory.create({
    data: { tenantId, name },
  });
}

export async function confirmPurchaseReceipt(
  tenantId: string,
  receiptId: string,
) {
  const prisma = getPrismaClient();
  const receipt = await prisma.purchaseReceipt.findFirst({
    where: { id: receiptId, tenantId, status: "DRAFT" },
    include: { items: true },
  });
  if (!receipt) throw new Error("Recepción no encontrada o ya procesada.");

  await prisma.$transaction(async (tx) => {
    for (const item of receipt.items) {
      await tx.lightweightStockMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          type: "purchase_receipt",
          quantity: Number(item.quantityReceived),
        },
      });
      await tx.lightweightProduct.update({
        where: { id: item.productId },
        data: { stock: { increment: Number(item.quantityReceived) } },
      });
    }
    await tx.purchaseReceipt.update({
      where: { id: receiptId },
      data: { status: "CONFIRMED" },
    });
  });

  return { ok: true };
}
