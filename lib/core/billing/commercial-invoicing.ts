import "@/lib/security/server-only";

import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";

export type InvoiceRegistration = {
  bankTransferRequestId: string;
  tenantId: string;
  planCode: string;
  amountUsd: number;
  currency: string;
  billingInterval: "MONTHLY" | "YEARLY";
};

export async function registerPendingInvoice(input: InvoiceRegistration, prisma: Prisma.TransactionClient) {
  // Caller holds the request lock. All effects use its transaction.
  const existing = await prisma.commercialInvoicePending.findUnique({ where: { bankTransferRequestId: input.bankTransferRequestId } });
  if (existing) return existing;
  const pending = await prisma.commercialInvoicePending.create({ data: { bankTransferRequestId: input.bankTransferRequestId } });

  await prisma.bankTransferRequest.update({
    where: { id: input.bankTransferRequestId },
    data: { invoiceStatus: "pending" },
  });

  const historical = await prisma.auditLog.findFirst({ where: { tenantId: input.tenantId, entityId: input.bankTransferRequestId, action: "commercial_invoice.pending" }, select: { id: true } });
  if (!historical) await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: "commercial_invoice.pending",
      entityType: "BankTransferRequest",
      entityId: input.bankTransferRequestId,
      metadata: {
        planCode: input.planCode,
        amountUsd: input.amountUsd,
        currency: input.currency,
        billingInterval: input.billingInterval,
        note: "Registro administrativo pendiente. No acredita la emisión de un comprobante tributario.",
      },
    },
  });
  return pending;
}

export async function getInvoicingStatus(bankTransferRequestId: string) {
  const prisma = getPrismaClient();
  const request = await prisma.bankTransferRequest.findUnique({
    where: { id: bankTransferRequestId },
    select: { invoiceStatus: true, invoiceReference: true },
  });

  return request
    ? { status: request.invoiceStatus, reference: request.invoiceReference }
    : null;
}
