import "@/lib/security/server-only";
import type { TreasurySourceType } from "@prisma/client";
import { appendMovement } from "./accounts";
import { audit, financialTransaction, lock, type Actor, type Tx } from "./db";
import { amount, cardAmounts, date, id, text, TreasuryError } from "./domain";

export async function captureCard(
  tx: Tx,
  actor: Actor,
  input: {
    accountId: string;
    gross: ReturnType<typeof amount>;
    date: Date;
    reference?: string | null;
    sourceId: string;
    sourceType: TreasurySourceType;
    saleId?: string | null;
    obligationId?: string | null;
    salePaymentId?: string;
  },
) {
  const existing = await tx.cardTransaction.findUnique({
    where: {
      tenantId_sourceId: { tenantId: actor.tenantId, sourceId: input.sourceId },
    },
  });
  if (existing) return existing;
  const account = await tx.treasuryAccount.findFirst({
    where: {
      id: input.accountId,
      tenantId: actor.tenantId,
      type: "CARD",
      active: true,
    },
  });
  if (!account) throw new TreasuryError("Canal de tarjeta no disponible.");
  const values = cardAmounts(
    input.gross,
    account.feePercentage,
    account.fixedFee,
  );
  const transaction = await tx.cardTransaction.create({
    data: {
      tenantId: actor.tenantId,
      cardAccountId: account.id,
      sourceId: input.sourceId,
      saleId: input.saleId,
      obligationId: input.obligationId,
      grossAmount: values.gross,
      feeAmount: values.fee,
      netAmount: values.net,
      transactionDate: input.date,
      expectedSettlementDate: new Date(
        input.date.getTime() + account.settlementDays * 86400000,
      ),
      reference: input.reference,
      createdByUserId: actor.userId,
    },
  });
  await appendMovement(tx, actor, {
    accountId: account.id,
    movementType: "CARD_COLLECTION",
    direction: "IN",
    amount: values.gross,
    date: input.date,
    description: "Cobro con tarjeta por acreditar",
    reference: input.reference,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    obligationId: input.obligationId,
    salePaymentId: input.salePaymentId,
  });
  return transaction;
}
export async function createCardCollection(
  actor: Actor,
  input: Record<string, unknown>,
) {
  return financialTransaction((tx) =>
    captureCard(tx, actor, {
      accountId: id(input.accountId),
      gross: amount(input.amount),
      date: input.date ? date(input.date) : new Date(),
      reference: text(input.reference, "Referencia", false),
      sourceId: id(input.requestKey),
      sourceType: "MANUAL",
    }),
  );
}
export async function settleCard(
  actor: Actor,
  transactionId: string,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    await lock(tx, "CardTransaction", actor.tenantId, [transactionId]);
    const card = await tx.cardTransaction.findFirst({
      where: { id: transactionId, tenantId: actor.tenantId },
      include: { cardAccount: true },
    });
    if (!card) throw new TreasuryError("Cobro no encontrado.", 404);
    if (card.status === "SETTLED") return card;
    if (card.status !== "PENDING")
      throw new TreasuryError("Solo se acreditan cobros pendientes.");
    const bankId = id(
      input.bankAccountId ?? card.cardAccount.settlementBankAccountId,
    );
    if (
      !(await tx.treasuryAccount.findFirst({
        where: {
          id: bankId,
          tenantId: actor.tenantId,
          type: "BANK",
          active: true,
          currency: card.cardAccount.currency,
        },
      }))
    )
      throw new TreasuryError("Banco destino no disponible.");
    await lock(tx, "TreasuryAccount", actor.tenantId, [
      bankId,
      card.cardAccountId,
    ]);
    const settledAt = input.date ? date(input.date) : new Date();
    if (settledAt < card.transactionDate || settledAt > new Date())
      throw new TreasuryError("Fecha de acreditación inválida.");
    const common = {
      date: settledAt,
      reference: card.reference,
      sourceType: "CARD" as const,
      sourceId: card.id,
      movementType: "CARD_SETTLEMENT" as const,
      description: "Acreditación de tarjeta",
    };
    const bankMovement = card.netAmount.gt(0)
      ? await appendMovement(tx, actor, {
          ...common,
          accountId: bankId,
          direction: "IN",
          amount: card.netAmount,
        })
      : null;
    if (card.netAmount.gt(0))
      await appendMovement(tx, actor, {
        ...common,
        accountId: card.cardAccountId,
        direction: "OUT",
        amount: card.netAmount,
      });
    if (card.feeAmount.gt(0))
      await appendMovement(tx, actor, {
        ...common,
        accountId: card.cardAccountId,
        direction: "OUT",
        movementType: "CARD_FEE",
        description: "Comisión de cobro con tarjeta",
        amount: card.feeAmount,
      });
    const result = await tx.cardTransaction.update({
      where: { id: card.id },
      data: { status: "SETTLED", settledAt, bankMovementId: bankMovement?.id },
    });
    await audit(tx, actor, "card_settled", "CardTransaction", card.id, {
      gross: card.grossAmount.toFixed(2),
      fee: card.feeAmount.toFixed(2),
      net: card.netAmount.toFixed(2),
      bankId,
    });
    return result;
  });
}
