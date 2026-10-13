import "@/lib/security/server-only";
import { randomUUID } from "node:crypto";
import type {
  TreasuryObligation,
  TreasuryObligationType,
  LightweightPaymentMethod,
} from "@prisma/client";
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
import {
  amount,
  choice,
  date,
  dec,
  id,
  obligationState,
  text,
  TreasuryError,
} from "./domain";

export async function createObligation(
  actor: Actor,
  type: TreasuryObligationType,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const partyId = id(input.partyId);
    await party(
      tx,
      actor.tenantId,
      type === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER",
      partyId,
    );
    const original = amount(input.originalAmount),
      balance = amount(input.balance ?? input.originalAmount, true);
    if (balance.gt(original))
      throw new TreasuryError("El saldo supera el valor original.");
    const issueDate = date(input.issueDate),
      dueDate = date(input.dueDate);
    if (dueDate < issueDate)
      throw new TreasuryError("El vencimiento es anterior a la emisión.");
    const obligation = await tx.treasuryObligation.create({
      data: {
        tenantId: actor.tenantId,
        type,
        customerId: type === "RECEIVABLE" ? partyId : null,
        supplierId: type === "PAYABLE" ? partyId : null,
        documentNumber: text(input.documentNumber, "Documento", false),
        documentType: "OPENING_OBLIGATION",
        issueDate,
        dueDate,
        originalAmount: original,
        paidAmount: original.minus(balance),
        ...obligationState(original, original.minus(balance), dueDate),
        externalReference: `manual:${id(input.requestKey)}`,
        notes: text(input.notes, "Notas", false, 2000),
        createdByUserId: actor.userId,
      },
    });
    await audit(
      tx,
      actor,
      "obligation_created",
      "TreasuryObligation",
      obligation.id,
    );
    return obligation;
  });
}

// Existing sale/purchase payment rows remain the only commercial payment record.
// Advances create a credit-method application, with no new TreasuryMovement.
export async function recordObligationPayment(
  tx: Tx,
  actor: Actor,
  obligation: TreasuryObligation,
  value: ReturnType<typeof amount>,
  method: LightweightPaymentMethod,
  paymentDate: Date,
  reference?: string | null,
) {
  if (
    obligation.status === "CANCELLED" ||
    obligation.balance.lt(value) ||
    value.lte(0)
  )
    throw new TreasuryError(
      "El pago supera el saldo pendiente o la obligación está cancelada.",
    );
  const nextPaid = obligation.paidAmount.plus(value);
  let salePaymentId: string | undefined, purchasePaymentId: string | undefined;
  if (obligation.saleId) {
    // Serialize against legacy addSalePayment too, via the same sale row lock.
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "LightweightSale" WHERE "id"=${obligation.saleId} AND "tenantId"=${actor.tenantId} FOR UPDATE`;
    if (!rows.length) throw new TreasuryError("Venta no disponible.");
    const sale = await tx.lightweightSale.findFirst({
      where: { id: obligation.saleId, tenantId: actor.tenantId },
      include: { payments: true },
    });
    if (!sale || sale.status === "canceled")
      throw new TreasuryError("Venta cancelada o no disponible.");
    const paid = sale.payments.reduce((sum, p) => sum.plus(p.amount), dec(0));
    if (sale.total.minus(paid).lt(value))
      throw new TreasuryError(
        "El saldo de la venta cambió. Actualiza la cartera.",
        409,
      );
    const payment = await tx.lightweightPayment.create({
      data: { saleId: sale.id, method, amount: value, createdAt: paymentDate },
    });
    salePaymentId = payment.id;
    const paymentStatus = paid.plus(value).eq(sale.total) ? "paid" : "partial";
    await tx.lightweightSale.update({
      where: { id: sale.id },
      data: {
        paymentStatus,
        status: paymentStatus === "paid" ? "paid" : "open",
      },
    });
    if (sale.customerId)
      await tx.lightweightCustomer.updateMany({
        where: { id: sale.customerId, tenantId: actor.tenantId },
        data: { balance: { decrement: value } },
      });
  }
  if (obligation.purchaseDocumentId) {
    const purchase = await tx.purchaseDocument.findFirst({
      where: {
        id: obligation.purchaseDocumentId,
        tenantId: actor.tenantId,
        status: { in: ["REGISTERED", "AUTHORIZED"] },
      },
      include: { payments: true },
    });
    if (!purchase) throw new TreasuryError("Compra no disponible.");
    const paid = purchase.payments.reduce(
      (sum, p) => sum.plus(p.amount),
      dec(0),
    );
    if (purchase.total.minus(paid).lt(value))
      throw new TreasuryError("El saldo de la compra cambió.", 409);
    const payment = await tx.purchasePayment.create({
      data: {
        purchaseDocumentId: purchase.id,
        method,
        amount: value,
        paidAt: paymentDate,
        notes: reference,
      },
    });
    purchasePaymentId = payment.id;
  }
  const updated = await tx.treasuryObligation.update({
    where: { id: obligation.id },
    data: {
      paidAmount: nextPaid,
      ...obligationState(
        obligation.originalAmount,
        nextPaid,
        obligation.dueDate,
      ),
    },
  });
  return { obligation: updated, salePaymentId, purchasePaymentId };
}

export async function collectOrPay(
  actor: Actor,
  obligationId: string,
  type: TreasuryObligationType,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const requestKey = id(input.requestKey);
    const existing = await tx.treasuryMovement.findFirst({
      where: {
        tenantId: actor.tenantId,
        sourceType: "OBLIGATION",
        sourceId: requestKey,
        obligationId,
      },
    });
    if (existing) return existing;
    await lockObligation(tx, actor.tenantId, obligationId);
    const obligation = await tx.treasuryObligation.findFirst({
      where: { id: obligationId, tenantId: actor.tenantId, type },
    });
    if (!obligation) throw new TreasuryError("Obligación no disponible.", 404);
    const accountId = id(input.accountId),
      method = choice(input.method, ["cash", "transfer", "card"] as const);
    const account = await tx.treasuryAccount.findFirst({
      where: {
        id: accountId,
        tenantId: actor.tenantId,
        active: true,
        type:
          method === "cash" ? "CASH" : method === "transfer" ? "BANK" : "CARD",
      },
    });
    if (!account || (type === "PAYABLE" && method === "card"))
      throw new TreasuryError(
        "Selecciona una cuenta válida para el método. Los canales de tarjeta representan cobros, no tarjetas de crédito para gastos.",
      );
    const value = amount(input.amount),
      paymentDate = input.date ? date(input.date) : new Date(),
      reference = text(input.reference, "Referencia", false);
    const result = await recordObligationPayment(
      tx,
      actor,
      obligation,
      value,
      method,
      paymentDate,
      reference,
    );
    if (method === "card")
      return captureCard(tx, actor, {
        accountId,
        gross: value,
        date: paymentDate,
        reference,
        sourceId: requestKey,
        sourceType: "OBLIGATION",
        obligationId,
        saleId: obligation.saleId,
        salePaymentId: result.salePaymentId,
      });
    return appendMovement(tx, actor, {
      accountId,
      amount: value,
      date: paymentDate,
      description:
        type === "RECEIVABLE" ? "Cobro de cartera" : "Pago a proveedor",
      reference,
      movementType:
        type === "RECEIVABLE" ? "SALE_COLLECTION" : "PURCHASE_PAYMENT",
      direction: type === "RECEIVABLE" ? "IN" : "OUT",
      sourceType: "OBLIGATION",
      sourceId: requestKey,
      obligationId,
      salePaymentId: result.salePaymentId,
      purchasePaymentId: result.purchasePaymentId,
    });
  });
}

export async function createAdvance(
  actor: Actor,
  type: "CUSTOMER" | "SUPPLIER",
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const requestKey = id(input.requestKey);
    const existing = await tx.treasuryMovement.findFirst({
      where: {
        tenantId: actor.tenantId,
        sourceType: "ADVANCE",
        sourceId: requestKey,
      },
    });
    if (existing) return existing;
    const partyId = id(input.partyId);
    await party(tx, actor.tenantId, type, partyId);
    const accountId = id(input.accountId),
      method = choice(input.method, ["cash", "transfer", "card"] as const);
    if (
      !(await tx.treasuryAccount.findFirst({
        where: {
          id: accountId,
          tenantId: actor.tenantId,
          active: true,
          type:
            method === "cash"
              ? "CASH"
              : method === "transfer"
                ? "BANK"
                : "CARD",
        },
      })) ||
      (type === "SUPPLIER" && method === "card")
    )
      throw new TreasuryError("Cuenta o método incompatible con el anticipo.");
    const value = amount(input.amount),
      at = input.date ? date(input.date) : new Date(),
      reference = text(input.reference, "Referencia", false);
    const advance = await tx.treasuryAdvance.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        type,
        customerId: type === "CUSTOMER" ? partyId : null,
        supplierId: type === "SUPPLIER" ? partyId : null,
        amount: value,
        balance: value,
        date: at,
        treasuryAccountId: accountId,
        paymentMethod: method,
        reference,
        notes: text(input.notes, "Notas", false, 2000),
        createdByUserId: actor.userId,
      },
    });
    if (method === "card")
      await captureCard(tx, actor, {
        accountId,
        gross: value,
        date: at,
        reference,
        sourceId: requestKey,
        sourceType: "ADVANCE",
      });
    else
      await appendMovement(tx, actor, {
        accountId,
        amount: value,
        date: at,
        description:
          type === "CUSTOMER" ? "Anticipo de cliente" : "Anticipo a proveedor",
        reference,
        direction: type === "CUSTOMER" ? "IN" : "OUT",
        movementType:
          type === "CUSTOMER" ? "CUSTOMER_ADVANCE" : "SUPPLIER_ADVANCE",
        sourceType: "ADVANCE",
        sourceId: requestKey,
      });
    await audit(tx, actor, "advance_created", "TreasuryAdvance", advance.id);
    return advance;
  });
}
export async function applyAdvance(
  actor: Actor,
  advanceId: string,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const requestKey = id(input.requestKey),
      obligationId = id(input.obligationId);
    const existing = await tx.advanceApplication.findUnique({
      where: { tenantId_requestKey: { tenantId: actor.tenantId, requestKey } },
    });
    if (existing) {
      if (
        existing.advanceId !== advanceId ||
        existing.obligationId !== obligationId
      )
        throw new TreasuryError("Referencia de aplicación ya utilizada.", 409);
      return existing;
    }
    await lock(tx, "TreasuryAdvance", actor.tenantId, [advanceId]);
    await lockObligation(tx, actor.tenantId, obligationId);
    const advance = await tx.treasuryAdvance.findFirst({
      where: { id: advanceId, tenantId: actor.tenantId },
    });
    const obligation = await tx.treasuryObligation.findFirst({
      where: { id: obligationId, tenantId: actor.tenantId },
    });
    if (
      !advance ||
      !obligation ||
      advance.status === "CANCELLED" ||
      (advance.type === "CUSTOMER"
        ? obligation.type !== "RECEIVABLE" ||
          advance.customerId !== obligation.customerId
        : obligation.type !== "PAYABLE" ||
          advance.supplierId !== obligation.supplierId)
    )
      throw new TreasuryError(
        "El anticipo y la obligación deben corresponder al mismo tercero y tipo.",
      );
    const value = amount(input.amount);
    if (value.gt(advance.balance) || value.gt(obligation.balance))
      throw new TreasuryError(
        "La aplicación supera el saldo del anticipo o de la obligación.",
      );
    await recordObligationPayment(
      tx,
      actor,
      obligation,
      value,
      "credit",
      new Date(),
      `Aplicación de anticipo ${advance.id}`,
    );
    const balance = advance.balance.minus(value),
      appliedAmount = advance.appliedAmount.plus(value);
    await tx.treasuryAdvance.update({
      where: { id: advance.id },
      data: {
        balance,
        appliedAmount,
        status: balance.isZero() ? "APPLIED" : "PARTIALLY_APPLIED",
      },
    });
    const application = await tx.advanceApplication.create({
      data: {
        tenantId: actor.tenantId,
        advanceId,
        obligationId,
        amount: value,
        requestKey,
        createdByUserId: actor.userId,
      },
    });
    await audit(
      tx,
      actor,
      "advance_applied",
      "AdvanceApplication",
      application.id,
      { amount: value.toFixed(2), advanceId, obligationId },
    );
    return application;
  });
}
