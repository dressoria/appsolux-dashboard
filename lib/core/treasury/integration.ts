import "@/lib/security/server-only";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { appendMovement } from "./accounts";
import { captureCard } from "./cards";
import {
  audit,
  financialTransaction,
  lock,
  lockObligation,
  party,
  type Actor,
  type Tx,
} from "./db";
import { dec, id, obligationState, TreasuryError } from "./domain";

export type IntegrationContext = {
  actor: Actor;
  accountId?: string;
  activatedAt: Date;
};
export async function prepareTreasuryIntegration(
  tenantId: string,
  userId?: string,
  accountId?: string,
): Promise<IntegrationContext | null> {
  let activation;
  try {
    activation = await getPrismaClient().treasuryAccount.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    )
      return null;
    throw error;
  }
  if (!activation) return null;
  if (!userId) {
    const { getCurrentUser } = await import("@/lib/auth/current-user");
    const user = await getCurrentUser();
    if (!user || user.tenant?.id !== tenantId)
      throw new TreasuryError("Sesión requerida para integrar Tesorería.", 401);
    userId = user.id;
  }
  const { requireTenantOperationalAccess } =
    await import("../tenant-operational-access");
  await requireTenantOperationalAccess(tenantId);
  return {
    actor: { tenantId, userId },
    accountId,
    activatedAt: activation.createdAt,
  };
}
async function paymentAccount(
  tx: Tx,
  context: IntegrationContext,
  method: string,
) {
  const type =
    method === "cash"
      ? "CASH"
      : method === "transfer"
        ? "BANK"
        : method === "card"
          ? "CARD"
          : null;
  if (!type) return null;
  const account = await tx.treasuryAccount.findFirst({
    where: {
      tenantId: context.actor.tenantId,
      active: true,
      type,
      ...(context.accountId
        ? { id: context.accountId }
        : { defaultAccount: true }),
    },
  });
  if (context.accountId && !account)
    throw new TreasuryError("Cuenta incompatible con el método de pago.");
  return account;
}
export async function allocatePayment(
  tx: Tx,
  context: IntegrationContext,
  kind: "SALE" | "PURCHASE",
  paymentId: string,
  at?: Date,
) {
  const { actor } = context;
  const existing = await tx.treasuryMovement.findFirst({
    where: {
      tenantId: actor.tenantId,
      ...(kind === "SALE"
        ? { salePaymentId: paymentId }
        : { purchasePaymentId: paymentId }),
    },
  });
  if (existing) return existing;
  if (kind === "SALE") {
    const payment = await tx.lightweightPayment.findFirst({
      where: {
        id: paymentId,
        sale: { tenantId: actor.tenantId, status: { not: "canceled" } },
        amount: { gt: 0 },
        method: { not: "credit" },
        createdAt: { gte: context.activatedAt },
      },
      include: { sale: { include: { treasuryObligation: true } } },
    });
    if (!payment) throw new TreasuryError("Pago nuevo de venta no disponible.");
    const account = await paymentAccount(tx, context, payment.method);
    if (!account) return null;
    const date = at ?? payment.createdAt;
    if (account.type === "CARD")
      return captureCard(tx, actor, {
        accountId: account.id,
        gross: payment.amount,
        date,
        sourceType: "SALE_PAYMENT",
        sourceId: payment.id,
        saleId: payment.saleId,
        obligationId: payment.sale.treasuryObligation?.id,
        salePaymentId: payment.id,
      });
    return appendMovement(tx, actor, {
      accountId: account.id,
      amount: payment.amount,
      date,
      description: "Cobro de venta",
      direction: "IN",
      movementType: "SALE_COLLECTION",
      sourceType: "SALE_PAYMENT",
      sourceId: payment.id,
      salePaymentId: payment.id,
      obligationId: payment.sale.treasuryObligation?.id,
    });
  }
  const payment = await tx.purchasePayment.findFirst({
    where: {
      id: paymentId,
      purchaseDocument: {
        tenantId: actor.tenantId,
        status: { in: ["REGISTERED", "AUTHORIZED"] },
        origin: "MANUAL",
      },
      amount: { gt: 0 },
      method: { in: ["cash", "transfer"] },
      createdAt: { gte: context.activatedAt },
    },
    include: { purchaseDocument: { include: { treasuryObligation: true } } },
  });
  if (!payment) throw new TreasuryError("Pago nuevo de compra no disponible.");
  const account = await paymentAccount(tx, context, payment.method);
  if (!account) return null;
  return appendMovement(tx, actor, {
    accountId: account.id,
    amount: payment.amount,
    date: at ?? payment.paidAt,
    description: "Pago de compra",
    direction: "OUT",
    movementType: "PURCHASE_PAYMENT",
    sourceType: "PURCHASE_PAYMENT",
    sourceId: payment.id,
    purchasePaymentId: payment.id,
    obligationId: payment.purchaseDocument.treasuryObligation?.id,
  });
}
export async function integrateSale(
  tx: Tx,
  context: IntegrationContext,
  saleId: string,
  paymentIds: string[],
) {
  const { actor } = context;
  const sale = await tx.lightweightSale.findFirst({
    where: {
      id: saleId,
      tenantId: actor.tenantId,
      origin: "NORMAL",
      status: { not: "canceled" },
    },
    include: { payments: true, treasuryObligation: true },
  });
  if (!sale) return;
  const paid = sale.payments.reduce((sum, p) => sum.plus(p.amount), dec(0)),
    balance = sale.total.minus(paid);
  if (sale.customerId && (balance.gt(0) || sale.treasuryObligation)) {
    const dueDate = sale.treasuryObligation?.dueDate ?? sale.createdAt;
    const data = {
      paidAmount: paid,
      ...obligationState(sale.total, paid, dueDate),
    };
    if (sale.treasuryObligation)
      await tx.treasuryObligation.update({
        where: { id: sale.treasuryObligation.id },
        data,
      });
    else
      await tx.treasuryObligation.create({
        data: {
          ...data,
          tenantId: actor.tenantId,
          type: "RECEIVABLE",
          customerId: sale.customerId,
          saleId,
          originalAmount: sale.total,
          issueDate: sale.createdAt,
          dueDate,
          documentType: "SALE",
          documentNumber: sale.id,
          externalReference: `sale:${sale.id}`,
          createdByUserId: actor.userId,
        },
      });
  }
  for (const paymentId of paymentIds) {
    const payment = sale.payments.find((p) => p.id === paymentId);
    if (payment && payment.amount.gt(0) && payment.method !== "credit")
      await allocatePayment(tx, context, "SALE", payment.id);
  }
}
export async function integratePurchase(
  tx: Tx,
  context: IntegrationContext,
  purchaseId: string,
) {
  const { actor } = context;
  const purchase = await tx.purchaseDocument.findFirst({
    where: {
      id: purchaseId,
      tenantId: actor.tenantId,
      origin: "MANUAL",
      status: { in: ["REGISTERED", "AUTHORIZED"] },
      documentType: { in: ["INVOICE", "DEBIT_NOTE", "PURCHASE_SETTLEMENT"] },
    },
    include: { payments: true, treasuryObligation: true },
  });
  if (!purchase) return;
  const paid = purchase.payments.reduce((sum, p) => sum.plus(p.amount), dec(0));
  if (paid.gt(purchase.total))
    throw new TreasuryError("Los pagos de la compra superan su total.");
  const supplier = purchase.supplierId
    ? await tx.lightweightSupplier.findFirst({
        where: { id: purchase.supplierId, tenantId: actor.tenantId },
      })
    : purchase.supplierIdentification
      ? await tx.lightweightSupplier.findFirst({
          where: {
            identification: purchase.supplierIdentification,
            tenantId: actor.tenantId,
          },
        })
      : null;
  if (supplier && purchase.total.gt(paid) && !purchase.treasuryObligation) {
    const issueDate = purchase.issueDate ?? purchase.createdAt,
      dueDate =
        purchase.dueDate ??
        new Date(
          issueDate.getTime() + (purchase.paymentTermDays ?? 0) * 86400000,
        );
    await tx.treasuryObligation.create({
      data: {
        tenantId: actor.tenantId,
        type: "PAYABLE",
        supplierId: supplier.id,
        purchaseDocumentId: purchase.id,
        originalAmount: purchase.total,
        paidAmount: paid,
        ...obligationState(purchase.total, paid, dueDate),
        issueDate,
        dueDate,
        documentNumber: purchase.supplierDocumentNumber,
        documentType: purchase.documentType,
        externalReference: `purchase:${purchase.id}`,
        createdByUserId: actor.userId,
      },
    });
  }
  for (const payment of purchase.payments)
    if (payment.amount.gt(0) && ["cash", "transfer"].includes(payment.method))
      await allocatePayment(tx, context, "PURCHASE", payment.id);
}
export async function allocateNewPayment(
  actor: Actor,
  input: Record<string, unknown>,
) {
  const context = await prepareTreasuryIntegration(
    actor.tenantId,
    actor.userId,
    id(input.accountId),
  );
  if (!context)
    throw new TreasuryError(
      "Crea una cuenta de Tesorería para activar la integración.",
    );
  const kind =
    input.kind === "SALE"
      ? "SALE"
      : input.kind === "PURCHASE"
        ? "PURCHASE"
        : null;
  if (!kind) throw new TreasuryError("Origen inválido.");
  return financialTransaction((tx) =>
    allocatePayment(tx, context, kind, id(input.paymentId), new Date()),
  );
}
export async function cancelTreasurySource(
  tx: Tx,
  context: IntegrationContext,
  kind: "SALE" | "PURCHASE",
  sourceId: string,
) {
  const { actor } = context;
  const obligation = await tx.treasuryObligation.findFirst({
    where: {
      tenantId: actor.tenantId,
      ...(kind === "SALE"
        ? { saleId: sourceId }
        : { purchaseDocumentId: sourceId }),
    },
  });
  const movements = await tx.treasuryMovement.count({
    where: {
      tenantId: actor.tenantId,
      ...(kind === "SALE"
        ? { salePayment: { saleId: sourceId } }
        : { purchasePayment: { purchaseDocumentId: sourceId } }),
    },
  });
  if (movements || obligation?.paidAmount.gt(0))
    throw new TreasuryError(
      "Esta operación tiene cobros/pagos integrados. Requiere una devolución vinculada; no se puede anular y dejar los saldos de Tesorería sin corregir.",
      409,
    );
  if (obligation) {
    await lockObligation(tx, actor.tenantId, obligation.id);
    await tx.treasuryObligation.update({
      where: { id: obligation.id },
      data: { status: "CANCELLED", balance: dec(0) },
    });
    await audit(
      tx,
      actor,
      "obligation_cancelled_with_source",
      "TreasuryObligation",
      obligation.id,
    );
  }
}
// SRI has already confirmed the cancellation. Compensate linked collections
// in the caller's transaction; never require a browser session for a worker.
export async function reverseSriCancelledSaleTreasury(tx: Tx, actor: Actor, saleId: string) {
  await lock(tx, "LightweightSale", actor.tenantId, [saleId]);
  const obligation = await tx.treasuryObligation.findFirst({ where: { tenantId: actor.tenantId, saleId } });
  if (obligation) await lockObligation(tx, actor.tenantId, obligation.id);
  const cards = await tx.cardTransaction.findMany({ where: { tenantId: actor.tenantId, saleId } });
  if (cards.length) await lock(tx, "CardTransaction", actor.tenantId, cards.map((c) => c.id));
  // A settled card requires its linked bank/fee refund flow, not a reversal
  // against the empty pending-card account.
  if (cards.some((c) => c.status === "SETTLED")) {
    throw new TreasuryError("La venta tiene tarjetas acreditadas. Requiere una devolución vinculada antes de finalizar la anulación SRI.", 409);
  }
  if (obligation && (await tx.advanceApplication.count({ where: { tenantId: actor.tenantId, obligationId: obligation.id } }) ||
      await tx.postdatedCheck.count({ where: { tenantId: actor.tenantId, obligationId: obligation.id, status: { not: "CANCELLED" } } }))) {
    throw new TreasuryError("La venta tiene anticipos o cheques vinculados. Requiere una devolución vinculada.", 409);
  }
  const movements = await tx.treasuryMovement.findMany({
    where: { tenantId: actor.tenantId, OR: [
      { salePayment: { saleId } },
      ...(obligation ? [{ obligationId: obligation.id }] : []),
    ] },
    include: { reversal: true },
    orderBy: { id: "asc" },
  });
  for (const movement of movements) {
    await lock(tx, "TreasuryMovement", actor.tenantId, [movement.id]);
    if (movement.reversal || movement.status === "CANCELLED") continue;
    if (movement.direction !== "IN" || !["SALE_COLLECTION", "CARD_COLLECTION"].includes(movement.movementType)) {
      throw new TreasuryError("El cobro requiere una devolución vinculada.", 409);
    }
    await appendMovement(tx, actor, {
      accountId: movement.accountId, amount: movement.amount, date: new Date(),
      direction: "OUT", movementType: "ADJUSTMENT", sourceType: "REVERSAL",
      sourceId: movement.id, reversalOfId: movement.id,
      description: "Reverso por anulación confirmada del SRI",
    });
    await tx.treasuryMovement.update({ where: { id: movement.id, tenantId: actor.tenantId }, data: {
      cancelledByUserId: actor.userId, cancelledAt: new Date(), cancellationReason: "Anulación confirmada del SRI",
    } });
  }
  for (const card of cards) {
    if (card.status === "PENDING") await tx.cardTransaction.update({ where: { id: card.id, tenantId: actor.tenantId }, data: { status: "CANCELLED" } });
  }
  if (obligation && obligation.status !== "CANCELLED") {
    await tx.treasuryObligation.update({ where: { id: obligation.id, tenantId: actor.tenantId }, data: { status: "CANCELLED", balance: dec(0), paidAmount: dec(0) } });
    await audit(tx, actor, "obligation_cancelled_with_source", "TreasuryObligation", obligation.id);
  }
}

export async function linkNewPurchasePayable(
  actor: Actor,
  input: Record<string, unknown>,
) {
  const purchaseId = id(input.purchaseId),
    supplierId = id(input.supplierId);
  const context = await prepareTreasuryIntegration(
    actor.tenantId,
    actor.userId,
  );
  if (!context) throw new TreasuryError("Tesorería no está activada.");
  return financialTransaction(async (tx) => {
    await lock(tx, "PurchaseDocument", actor.tenantId, [purchaseId]);
    const purchase = await tx.purchaseDocument.findFirst({
      where: {
        id: purchaseId,
        tenantId: actor.tenantId,
        origin: "MANUAL",
        createdAt: { gte: context.activatedAt },
        status: { in: ["REGISTERED", "AUTHORIZED"] },
      },
    });
    if (!purchase) throw new TreasuryError("Compra nueva no disponible.");
    const supplier = await party(tx, actor.tenantId, "SUPPLIER", supplierId);
    if (
      purchase.supplierIdentification &&
      supplier.identification !== purchase.supplierIdentification
    )
      throw new TreasuryError(
        "La identificación del proveedor no coincide con la compra.",
      );
    await tx.purchaseDocument.update({
      where: { id: purchase.id },
      data: { supplierId },
    });
    await integratePurchase(tx, context, purchase.id);
    await audit(
      tx,
      actor,
      "purchase_supplier_linked",
      "PurchaseDocument",
      purchase.id,
      { supplierId },
    );
    return { ok: true };
  });
}
