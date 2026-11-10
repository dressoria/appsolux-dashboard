import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { CreditNoteType, ProductTaxCategory } from "@prisma/client";
export class SalesDocumentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type Item = Record<string, unknown>;
type DocumentInput = {
  sourceSriDocumentId?: string; type?: CreditNoteType; reason?: string;
  customerName?: string; customerIdentification?: string; customerEmail?: string; customerAddress?: string;
  customerId?: string; warehouseId?: string; issueDate?: string; expectedDate?: string;
  sellerName?: string; status?: string; observation?: string;
  subtotal?: number; discount?: number; tax?: number; total?: number;
  items?: Item[]; reasons?: Item[];
};

export async function createSalesCreditNote(tenantId: string, userId: string, body: DocumentInput) {
  const prisma = getPrismaClient();

  const sourceSriDocId = body.sourceSriDocumentId;
  if (!sourceSriDocId) {
    throw new SalesDocumentError("Factura de origen requerida.", 400);
  }

  const sourceDoc = await prisma.sriDocument.findFirst({
    where: { id: sourceSriDocId, tenantId: tenantId, status: "AUTHORIZED", documentType: "INVOICE" },
  });
  if (!sourceDoc) {
    throw new SalesDocumentError("La factura de origen debe estar AUTORIZADA y pertenecer al tenant.", 400);
  }

  const lastNote = await prisma.salesCreditNote.findFirst({
    where: { tenantId: tenantId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (lastNote?.number ?? 0) + 1;

  const items = (body.items ?? []).map((item: Record<string, unknown>) => ({
    productId: (item.productId as string) || null,
    code: (item.code as string) || null,
    productName: (item.productName as string) ?? "—",
    description: (item.description as string) || null,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount ?? 0),
    taxRate: Number(item.taxRate ?? 0),
    taxCategory: (item.taxCategory as ProductTaxCategory) || null,
    taxAmount: Number(item.tax ?? 0),
    subtotal: Number(item.subtotal),
    total: Number(item.total),
    maxQuantity: Number(item.quantity),
  }));

  const customerSnapshot = {
    name: body.customerName ?? "Consumidor Final",
    identification: body.customerIdentification ?? null,
    email: body.customerEmail ?? null,
    address: body.customerAddress ?? null,
  };

  const note = await prisma.salesCreditNote.create({
    data: {
      tenantId: tenantId,
      number: nextNumber,
      sourceSriDocumentId: sourceSriDocId,
      creditNoteType: body.type ?? "RETURN",
      reason: body.reason ?? "Devolución de mercadería",
      customerSnapshot,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      status: "DRAFT",
      subtotal: Number(body.subtotal ?? 0),
      tax: Number(body.tax ?? 0),
      total: Number(body.total ?? 0),
      createdByUserId: userId,
      items: { create: items },
    },
  });

  return { ok: true, id: note.id, number: nextNumber };
}

export async function createSalesDebitNote(tenantId: string, userId: string, body: DocumentInput) {
  const prisma = getPrismaClient();

  const sourceSriDocId = body.sourceSriDocumentId;
  if (!sourceSriDocId) {
    throw new SalesDocumentError("Factura de origen requerida.", 400);
  }

  const sourceDoc = await prisma.sriDocument.findFirst({
    where: { id: sourceSriDocId, tenantId: tenantId, status: "AUTHORIZED", documentType: "INVOICE" },
  });
  if (!sourceDoc) {
    throw new SalesDocumentError("La factura de origen debe estar AUTORIZADA y pertenecer al tenant.", 400);
  }

  const lastNote = await prisma.salesDebitNote.findFirst({
    where: { tenantId: tenantId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (lastNote?.number ?? 0) + 1;

  const reasons = (body.reasons ?? []).map((r: Record<string, unknown>) => ({
    description: r.description as string,
    amount: Number(r.amount),
    taxRate: Number(r.taxRate ?? 0),
    taxAmount: Number(r.tax ?? 0),
    total: Number(r.total ?? 0),
  }));

  const customerSnapshot = {
    name: body.customerName ?? "Consumidor Final",
    identification: body.customerIdentification ?? null,
    email: body.customerEmail ?? null,
    address: body.customerAddress ?? null,
  };

  const note = await prisma.salesDebitNote.create({
    data: {
      tenantId: tenantId,
      number: nextNumber,
      sourceSriDocumentId: sourceSriDocId,
      customerSnapshot,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      status: "DRAFT",
      tax: Number(body.tax ?? 0),
      total: Number(body.total ?? 0),
      createdByUserId: userId,
      reasons: { create: reasons },
    },
  });

  return { ok: true, id: note.id, number: nextNumber };
}

export async function createSalesOrder(tenantId: string, userId: string, body: DocumentInput) {
  const prisma = getPrismaClient();

  const lastOrder = await prisma.salesOrder.findFirst({
    where: { tenantId: tenantId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (lastOrder?.number ?? 0) + 1;

  const items = (body.items ?? []).map((item: Record<string, unknown>) => ({
    productId: (item.productId as string) || null,
    code: (item.code as string) || null,
    productName: item.productName as string,
    description: (item.description as string) || null,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount ?? 0),
    taxRate: Number(item.taxRate ?? 0),
    taxCategory: (item.taxCategory as ProductTaxCategory) || null,
    subtotal: Number(item.subtotal),
    tax: Number(item.tax ?? 0),
    total: Number(item.total),
  }));

  let customerSnapshot = null;
  if (body.customerId) {
    const c = await prisma.lightweightCustomer.findFirst({
      where: { id: body.customerId, tenantId: tenantId },
      select: { name: true, identification: true, email: true, phone: true, address: true },
    });
    if (c) customerSnapshot = c;
  }

  const order = await prisma.salesOrder.create({
    data: {
      tenantId: tenantId,
      number: nextNumber,
      customerId: body.customerId || null,
      customerSnapshot: customerSnapshot ?? undefined,
      warehouseId: body.warehouseId || null,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      sellerName: body.sellerName || null,
      status: body.status === "CONFIRMED" ? "CONFIRMED" : "DRAFT",
      observation: body.observation || null,
      subtotal: Number(body.subtotal ?? 0),
      discount: Number(body.discount ?? 0),
      tax: Number(body.tax ?? 0),
      total: Number(body.total ?? 0),
      createdByUserId: userId,
      items: { create: items },
    },
  });

  return { ok: true, id: order.id, number: nextNumber };
}

export async function transitionSalesOrder(tenantId: string, orderId: string, action: "confirm" | "cancel") {
  const db = getPrismaClient();
  const order = await db.salesOrder.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new SalesDocumentError("Orden no encontrada", 404);
  if (action === "confirm" && order.status !== "DRAFT") throw new SalesDocumentError("Solo órdenes en borrador pueden confirmarse", 409);
  if (action === "cancel" && order.status === "CONVERTED") throw new SalesDocumentError("Orden ya convertida, no se puede cancelar", 409);
  const status = action === "confirm" ? "CONFIRMED" : "CANCELLED";
  const changed = await db.salesOrder.updateMany({ where: { id: orderId, tenantId, status: order.status }, data: { status } });
  if (changed.count !== 1) throw new SalesDocumentError("La orden cambió concurrentemente. Actualiza su estado.", 409);
  return { ok: true, status };
}
