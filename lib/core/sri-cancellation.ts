import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import type { SriCancellationReason, SriCancellationStatus } from "@prisma/client";

const CONSUMER_FINAL_IDS = new Set(["9999999999999", "9999999999"]);

const ACTIVE_STATUSES: SriCancellationStatus[] = [
  "QUEUED",
  "RUNNING",
  "SUBMITTED",
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

function getDeadlineDate(authorizedAt: Date | string): Date {
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
  return new Date(Date.UTC(nextYear, nextMonth - 1, CANCELLATION_DEADLINE_DAY + 1, 4, 59, 59));
}

export async function checkCancellationEligibility(
  tenantId: string,
  sriDocumentId: string,
): Promise<CancellationEligibility> {
  const prisma = getPrismaClient();

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

  const eligibility = await checkCancellationEligibility(input.tenantId, input.sriDocumentId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? "No se puede anular esta factura.");
  }

  const request = await prisma.sriCancellationRequest.create({
    data: {
      tenantId: input.tenantId,
      sriDocumentId: input.sriDocumentId,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText?.trim() || null,
      requestedByUserId: input.requestedByUserId,
      status: "QUEUED",
    },
  });

  return request;
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
  confirmedByUserId: string,
) {
  const prisma = getPrismaClient();

  const request = await prisma.sriCancellationRequest.findFirst({
    where: { id: requestId, tenantId },
    include: {
      sriDocument: {
        select: {
          id: true,
          status: true,
          sourceType: true,
          sourceId: true,
          tenantId: true,
        },
      },
    },
  });

  if (!request) throw new Error("Solicitud de anulación no encontrada.");
  if (request.status === "CONFIRMED") return { alreadyConfirmed: true };

  return prisma.$transaction(async (tx) => {
    await tx.sriCancellationRequest.update({
      where: { id: requestId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    await tx.sriDocument.update({
      where: { id: request.sriDocumentId },
      data: { status: "CANCELLED" },
    });

    if (request.sriDocument.sourceType === "BASIC_SALE" && request.sriDocument.sourceId) {
      const sale = await tx.lightweightSale.findFirst({
        where: { id: request.sriDocument.sourceId, tenantId },
        include: {
          items: {
            include: {
              product: {
                include: { comboItems: { include: { componentProduct: true } } },
              },
            },
          },
          payments: true,
        },
      });

      if (sale && sale.status !== "canceled") {
        const { cancelTreasurySource, prepareTreasuryIntegration } = await import(
          "@/lib/core/treasury/integration"
        );
        const treasury = await prepareTreasuryIntegration(tenantId);
        if (treasury) {
          await cancelTreasurySource(tx, treasury, "SALE", sale.id);
        }

        const inventoryRestore = new Map<string, number>();
        for (const item of sale.items) {
          if (item.product.type === "PRODUCT" && item.product.trackInventory) {
            inventoryRestore.set(
              item.productId,
              (inventoryRestore.get(item.productId) ?? 0) + item.quantity,
            );
          }
          if (item.product.type === "COMBO") {
            for (const comp of item.product.comboItems) {
              if (comp.componentProduct.trackInventory) {
                inventoryRestore.set(
                  comp.componentProductId,
                  (inventoryRestore.get(comp.componentProductId) ?? 0) +
                    comp.quantity * item.quantity,
                );
              }
            }
          }
        }

        const defaultWarehouse = await tx.inventoryWarehouse.findFirst({
          where: { tenantId, isDefault: true },
        });

        for (const [productId, quantity] of inventoryRestore) {
          await tx.lightweightProduct.update({
            where: { id: productId },
            data: { stock: { increment: quantity } },
          });
          await tx.lightweightStockMovement.create({
            data: { tenantId, productId, type: "adjustment", quantity },
          });

          if (defaultWarehouse) {
            const existing = await tx.inventoryMovement.findFirst({
              where: {
                tenantId,
                sourceType: "SRI_CANCELLATION",
                sourceId: requestId,
                productId,
              },
            });
            if (!existing) {
              await tx.inventoryMovement.create({
                data: {
                  tenantId,
                  productId,
                  warehouseId: defaultWarehouse.id,
                  direction: "IN",
                  movementType: "SALE_RETURN",
                  quantity,
                  date: new Date(),
                  sourceType: "SRI_CANCELLATION",
                  sourceId: requestId,
                  createdByUserId: confirmedByUserId,
                },
              });
              await tx.inventoryStockBalance.upsert({
                where: {
                  tenantId_warehouseId_productId: {
                    tenantId,
                    warehouseId: defaultWarehouse.id,
                    productId,
                  },
                },
                create: { tenantId, productId, warehouseId: defaultWarehouse.id, quantity },
                update: { quantity: { increment: quantity } },
              });
            }
          }
        }

        try {
          const { reverseJournalEntry } = await import("@/lib/core/accounting-journal");
          const journalEntry = await tx.accountingJournalEntry.findFirst({
            where: {
              tenantId,
              sourceType: "SALE",
              sourceId: sale.id,
              status: "POSTED",
            },
          });
          if (journalEntry) {
            await reverseJournalEntry(tenantId, journalEntry.id, confirmedByUserId, new Date());
          }
        } catch {
          // Accounting may not be set up
        }

        await tx.lightweightSale.update({
          where: { id: sale.id },
          data: { status: "canceled" },
        });
      }
    }

    return { alreadyConfirmed: false };
  });
}
