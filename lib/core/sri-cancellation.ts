import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import { Prisma, type SriCancellationReason, type SriCancellationStatus } from "@prisma/client";

const CONSUMER_FINAL_IDS = new Set(["9999999999999", "9999999999"]);

const ACTIVE_STATUSES: SriCancellationStatus[] = [
  "QUEUED",
  "RUNNING",
  "SUBMITTED",
  "HUMAN_VERIFICATION_REQUIRED",
];

const CANCELLATION_DEADLINE_DAY = 7;

export type RequestCancellationInput = {
  tenantId: string;
  sriDocumentId: string;
  reasonCode: SriCancellationReason;
  reasonText?: string;
  requestedByUserId: string;
};

export type CancellationEligibility = {
  eligible: boolean;
  reason?: string;
  deadlineDate?: string;
  hasCredentials: boolean;
};

export const LIVE_SRI_CANCELLATION_VERIFICATION_PENDING = true;

export function getDeadlineDate(authorizedAt: Date | string): Date {
  const auth = typeof authorizedAt === "string" ? new Date(authorizedAt) : authorizedAt;
  const ecParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "numeric",
  }).formatToParts(auth);
  const ecYear = Number(ecParts.find((p) => p.type === "year")!.value);
  const ecMonth = Number(ecParts.find((p) => p.type === "month")!.value);
  const nextMonth = ecMonth === 12 ? 1 : ecMonth + 1;
  const nextYear = ecMonth === 12 ? ecYear + 1 : ecYear;
  // ECT = UTC-5, no DST. Day 7 at 23:59:59 ECT = day 8 at 04:59:59 UTC
  return new Date(Date.UTC(nextYear, nextMonth - 1, CANCELLATION_DEADLINE_DAY + 1, 4, 59, 59, 999));
}

export async function checkCancellationEligibility(
  tenantId: string,
  sriDocumentId: string,
  prisma: Prisma.TransactionClient = getPrismaClient(),
): Promise<CancellationEligibility> {

  const doc = await prisma.sriDocument.findFirst({
    where: { id: sriDocumentId, tenantId },
    select: {
      id: true,
      status: true,
      documentType: true,
      customerIdentification: true,
      issuedAt: true,
      createdAt: true,
      submissionJobs: {
        where: { sriAuthorizationStatus: "AUTORIZADO" },
        select: { authorizedAt: true },
        orderBy: { authorizedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!doc) {
    return { eligible: false, reason: "Documento no encontrado.", hasCredentials: false };
  }

  const credential = await prisma.purchaseSriCredential.findUnique({
    where: { tenantId },
    select: { status: true },
  });

  const hasCredentials = !!credential && credential.status === "VERIFIED";

  if (doc.documentType !== "INVOICE") {
    return { eligible: false, reason: "Solo se pueden anular facturas.", hasCredentials };
  }

  if (doc.status !== "AUTHORIZED") {
    return { eligible: false, reason: "Solo se pueden anular facturas autorizadas por el SRI.", hasCredentials };
  }

  if (doc.customerIdentification && CONSUMER_FINAL_IDS.has(doc.customerIdentification)) {
    return {
      eligible: false,
      reason: "Las facturas transmitidas al SRI como consumidor final no pueden anularse.",
      hasCredentials,
    };
  }

  const activeRequest = await prisma.sriCancellationRequest.findFirst({
    where: {
      tenantId,
      sriDocumentId,
      status: { in: ACTIVE_STATUSES },
    },
  });

  if (activeRequest) {
    return { eligible: false, reason: "Ya existe una solicitud de anulación activa para esta factura.", hasCredentials };
  }

  const confirmedRequest = await prisma.sriCancellationRequest.findFirst({
    where: {
      tenantId,
      sriDocumentId,
      status: "CONFIRMED",
    },
  });

  if (confirmedRequest) {
    return { eligible: false, reason: "Esta factura ya fue anulada.", hasCredentials };
  }

  const authorizedAt = doc.submissionJobs[0]?.authorizedAt ?? doc.issuedAt ?? doc.createdAt;
  const deadline = getDeadlineDate(authorizedAt);
  const now = new Date();

  const deadlineStr = deadline.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Guayaquil",
  });

  if (now > deadline) {
    return {
      eligible: false,
      reason: "Esta factura está fuera del plazo de anulación en línea. Debe gestionarse mediante nota de crédito cuando corresponda.",
      deadlineDate: deadlineStr,
      hasCredentials,
    };
  }

  if (!hasCredentials) {
    return {
      eligible: false,
      reason: "Configura tu acceso al portal SRI para realizar la anulación en línea.",
      deadlineDate: deadlineStr,
      hasCredentials: false,
    };
  }

  return { eligible: true, deadlineDate: deadlineStr, hasCredentials };
}

export async function requestSriInvoiceCancellation(
  input: RequestCancellationInput,
) {
  await requireTenantOperationalAccess(input.tenantId);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    // Serialize requests for the same tenant/document before checking eligibility.
    await tx.$queryRaw`SELECT "id" FROM "SriDocument" WHERE "id"=${input.sriDocumentId} AND "tenantId"=${input.tenantId} FOR UPDATE`;
    const eligibility = await checkCancellationEligibility(input.tenantId, input.sriDocumentId, tx);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason ?? "No se puede anular esta factura.");
    }
    return tx.sriCancellationRequest.create({
      data: {
        tenantId: input.tenantId,
        sriDocumentId: input.sriDocumentId,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText?.trim() || null,
        requestedByUserId: input.requestedByUserId,
        status: "QUEUED",
      },
    });
  });
}

export async function getCancellationRequestsForDocument(
  tenantId: string,
  sriDocumentId: string,
) {
  const prisma = getPrismaClient();
  return prisma.sriCancellationRequest.findMany({
    where: { tenantId, sriDocumentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function finalizeSriInvoiceCancellation(
  tenantId: string,
  requestId: string,
  confirmation: { sriConfirmed: true; workerId: string },
) {
  if (confirmation.sriConfirmed !== true || !confirmation.workerId) {
    throw new Error("Se requiere confirmación real del SRI.");
  }
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.sriCancellationRequest.findFirst({
      where: { id: requestId, tenantId },
      select: { sriDocumentId: true },
    });
    if (!candidate) throw new Error("Solicitud de anulación no encontrada.");
    // The document lock also serializes different requests for the same invoice.
    await tx.$queryRaw`SELECT "id" FROM "SriDocument" WHERE "id"=${candidate.sriDocumentId} AND "tenantId"=${tenantId} FOR UPDATE`;
    const request = await tx.sriCancellationRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { sriDocument: true },
    });
    if (!request || request.sriDocument.tenantId !== tenantId) {
      throw new Error("Solicitud de anulación no encontrada.");
    }
    if (request.workerId !== confirmation.workerId) {
      throw new Error("El worker no corresponde a esta solicitud.");
    }
    if (request.status === "CONFIRMED" && request.sriDocument.status === "CANCELLED") {
      return { alreadyConfirmed: true };
    }
    if (request.status !== "SUBMITTED" || request.sriDocument.status !== "AUTHORIZED") {
      throw new Error("La solicitud no está pendiente de confirmación del SRI.");
    }
    const confirmedByUserId = request.requestedByUserId;
    if (request.sriDocument.sourceType === "BASIC_SALE" && request.sriDocument.sourceId) {
      const saleId = request.sriDocument.sourceId;
      await tx.$queryRaw`SELECT "id" FROM "LightweightSale" WHERE "id"=${saleId} AND "tenantId"=${tenantId} FOR UPDATE`;
      const sale = await tx.lightweightSale.findFirst({
        where: { id: saleId, tenantId },
        include: {
          items: { include: { product: { include: { comboItems: { include: { componentProduct: true } } } } } },
          payments: true,
        },
      });
      if (!sale) throw new Error("Venta no encontrada en esta empresa.");
      if (sale.status !== "canceled") {
        const { reverseSriCancelledSaleTreasury } = await import("@/lib/core/treasury/integration");
        await reverseSriCancelledSaleTreasury(tx, { tenantId, userId: confirmedByUserId }, sale.id);

        // Prefer the immutable sale movements: combo definitions, tracking and
        // the default warehouse may have changed since the sale was issued.
        const originalMovements = await tx.inventoryMovement.findMany({
          where: { tenantId, sourceType: "SALE", sourceId: sale.id, direction: "OUT", movementType: { in: ["SALE", "COMBO_CONSUMPTION"] } },
        });
        const restore: Array<{ productId: string; warehouseId: string; quantity: number }> = [];
        if (originalMovements.length) {
          restore.push(...originalMovements.map((m) => ({ productId: m.productId, warehouseId: m.warehouseId, quantity: Number(m.quantity) })));
        } else {
          // Legacy sales predate Inventory Core movements.
          const quantities = new Map<string, number>();
          for (const item of sale.items) {
            if (item.product.tenantId !== tenantId) throw new Error("Producto fuera de esta empresa.");
            if (item.product.type === "PRODUCT" && item.product.trackInventory) {
              quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
            }
            if (item.product.type === "COMBO") {
              for (const comp of item.product.comboItems) {
                if (comp.componentProduct.tenantId !== tenantId) throw new Error("Componente fuera de esta empresa.");
                if (comp.componentProduct.type === "PRODUCT" && comp.componentProduct.trackInventory) {
                  quantities.set(comp.componentProductId, (quantities.get(comp.componentProductId) ?? 0) + comp.quantity * item.quantity);
                }
              }
            }
          }
          if (quantities.size) {
            const warehouse = await tx.inventoryWarehouse.findFirst({ where: { tenantId, isDefault: true, active: true } });
            if (!warehouse) throw new Error("Configura una bodega para restaurar el inventario.");
            restore.push(...Array.from(quantities, ([productId, quantity]) => ({ productId, quantity, warehouseId: warehouse.id })));
          }
        }
        for (const { productId, warehouseId, quantity } of restore) {
          await tx.lightweightProduct.update({ where: { id: productId, tenantId }, data: { stock: { increment: quantity } } });
          await tx.lightweightStockMovement.create({ data: { tenantId, productId, type: "adjustment", quantity } });
          await tx.inventoryMovement.create({ data: {
            tenantId, productId, warehouseId, direction: "IN", movementType: "SALE_RETURN", quantity,
            date: new Date(), sourceType: "SRI_CANCELLATION", sourceId: requestId, createdByUserId: confirmedByUserId,
          } });
          await tx.inventoryStockBalance.upsert({
            where: { tenantId_warehouseId_productId: { tenantId, warehouseId, productId } },
            create: { tenantId, productId, warehouseId, quantity },
            update: { quantity: { increment: quantity } },
          });
        }
        const { reverseJournalEntry } = await import("@/lib/core/accounting-journal");
        const journalEntry = await tx.accountingJournalEntry.findFirst({
          where: { tenantId, sourceType: "SALE", sourceId: sale.id, status: "POSTED" },
        });
        if (journalEntry) {
          await reverseJournalEntry(tenantId, journalEntry.id, confirmedByUserId, new Date(), tx);
        }
        const paid = sale.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
        const unpaid = sale.total.minus(paid);
        if (sale.customerId && unpaid.gt(0)) {
          await tx.lightweightCustomer.update({ where: { id: sale.customerId, tenantId }, data: { balance: { decrement: unpaid } } });
        }
        await tx.lightweightSale.update({ where: { id: sale.id, tenantId }, data: { status: "canceled" } });
      }
    }
    await tx.sriCancellationRequest.update({
      where: { id: requestId, tenantId }, data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    await tx.sriDocument.update({ where: { id: request.sriDocumentId, tenantId }, data: { status: "CANCELLED" } });
    return { alreadyConfirmed: false };
  }, { timeout: 20000 });
}
