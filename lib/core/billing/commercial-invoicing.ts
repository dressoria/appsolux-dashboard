import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

export type InvoiceRegistration = {
  bankTransferRequestId: string;
  tenantId: string;
  planCode: string;
  amountUsd: number;
  currency: string;
  billingInterval: "MONTHLY" | "YEARLY";
};

export async function registerPendingInvoice(input: InvoiceRegistration) {
  const prisma = getPrismaClient();

  await prisma.bankTransferRequest.update({
    where: { id: input.bankTransferRequestId },
    data: { invoiceStatus: "pending" },
  });

  await prisma.auditLog.create({
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
        note: "Factura comercial pendiente de emisión. Requiere configuración del emisor autorizado.",
      },
    },
  });
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
