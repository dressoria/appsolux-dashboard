import "@/lib/security/server-only";
import { randomUUID } from "node:crypto";
import type {
  TreasuryAccountType,
  TreasuryMovementDirection,
  TreasuryMovementType,
  TreasurySourceType,
} from "@prisma/client";
import { amount, choice, date, id, text, TreasuryError } from "./domain";
import {
  accountBalance,
  audit,
  financialTransaction,
  lock,
  type Actor,
  type Tx,
} from "./db";

export async function saveAccount(
  actor: Actor,
  type: TreasuryAccountType,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const accountId = input.id ? id(input.id) : null;
    const current = accountId
      ? await tx.treasuryAccount.findFirst({
          where: { id: accountId, tenantId: actor.tenantId, type },
        })
      : null;
    if (accountId && !current)
      throw new TreasuryError("Cuenta no encontrada.", 404);
    if (
      !current &&
      (await tx.treasuryAccount.findFirst({
        where: {
          tenantId: actor.tenantId,
          type,
          name: text(input.name, "Nombre")!,
        },
      }))
    )
      throw new TreasuryError(
        "Ya existe una cuenta con ese nombre. Usa Editar para modificarla.",
        409,
      );
    if (accountId)
      await lock(tx, "TreasuryAccount", actor.tenantId, [accountId]);
    const active =
      input.active === undefined
        ? (current?.active ?? true)
        : choice(String(input.active), ["true", "false"] as const) === "true";
    if (!active && accountId) {
      if (!(await accountBalance(tx, actor.tenantId, accountId)).isZero())
        throw new TreasuryError(
          "Transfiere o corrige el saldo antes de desactivar la cuenta.",
        );
      if (
        (await tx.cashSession.count({
          where: {
            tenantId: actor.tenantId,
            cashAccountId: accountId,
            status: "OPEN",
          },
        })) ||
        (await tx.cardTransaction.count({
          where: {
            tenantId: actor.tenantId,
            cardAccountId: accountId,
            status: "PENDING",
          },
        })) ||
        (await tx.treasuryAccount.count({
          where: {
            tenantId: actor.tenantId,
            settlementBankAccountId: accountId,
            active: true,
          },
        }))
      )
        throw new TreasuryError(
          "Cierra las sesiones y liquidaciones pendientes antes de desactivar la cuenta.",
        );
    }
    const defaultAccount =
      active &&
      (input.defaultAccount === undefined
        ? (current?.defaultAccount ?? false)
        : input.defaultAccount === true || input.defaultAccount === "true");
    if (defaultAccount)
      await tx.treasuryAccount.updateMany({
        where: { tenantId: actor.tenantId, type, defaultAccount: true },
        data: { defaultAccount: false },
      });
    const settlementBankAccountId =
      type === "CARD"
        ? text(
            input.settlementBankAccountId ?? current?.settlementBankAccountId,
            "Banco de acreditación",
            false,
          )
        : null;
    if (
      settlementBankAccountId &&
      !(await tx.treasuryAccount.findFirst({
        where: {
          id: settlementBankAccountId,
          tenantId: actor.tenantId,
          type: "BANK",
          active: true,
        },
      }))
    )
      throw new TreasuryError("Banco de acreditación no disponible.");
    const feePercentage =
      type === "CARD"
        ? amount(
            input.feePercentage ?? current?.feePercentage.toString() ?? "0",
            true,
          )
        : amount("0", true);
    if (feePercentage.gt(100))
      throw new TreasuryError("Comisión fuera de rango.");
    const settlementDays = Number(
      input.settlementDays ?? current?.settlementDays ?? 2,
    );
    if (
      !Number.isInteger(settlementDays) ||
      settlementDays < 0 ||
      settlementDays > 90
    )
      throw new TreasuryError("Plazo de acreditación inválido.");
    const bankNumber = text(input.accountNumber, "Número de cuenta", false, 50);
    if (bankNumber && !/^[0-9 -]{4,50}$/.test(bankNumber))
      throw new TreasuryError("Número bancario inválido.");
    const data = {
      name: text(input.name ?? current?.name, "Nombre")!,
      code: text(input.code ?? current?.code, "Código", false),
      active,
      defaultAccount,
      responsibleName: text(
        input.responsibleName ?? current?.responsibleName,
        "Responsable",
        false,
      ),
      bankName:
        type === "BANK"
          ? text(input.bankName ?? current?.bankName, "Banco")
          : null,
      accountName:
        type === "BANK"
          ? text(
              input.accountName ?? current?.accountName ?? input.name,
              "Titular",
            )
          : null,
      accountNumberMasked: bankNumber
        ? `****${bankNumber.replace(/\D/g, "").slice(-4)}`
        : (current?.accountNumberMasked ?? null),
      bankAccountType:
        type === "BANK"
          ? choice(
              input.bankAccountType ?? current?.bankAccountType ?? "CHECKING",
              ["CHECKING", "SAVINGS", "OTHER"] as const,
            )
          : null,
      provider:
        type === "CARD"
          ? text(input.provider ?? current?.provider, "Proveedor")
          : null,
      settlementBankAccountId,
      feePercentage,
      fixedFee:
        type === "CARD"
          ? amount(input.fixedFee ?? current?.fixedFee.toString() ?? "0", true)
          : amount("0", true),
      settlementDays,
    };
    const openingDate = input.openingDate
      ? date(input.openingDate)
      : new Date();
    if (!current && openingDate > new Date())
      throw new TreasuryError("El saldo inicial no puede tener fecha futura.");
    const account = current
      ? await tx.treasuryAccount.update({ where: { id: current.id }, data })
      : await tx.treasuryAccount.create({
          data: {
            ...data,
            type,
            tenantId: actor.tenantId,
            createdByUserId: actor.userId,
            currency: choice(input.currency ?? "USD", ["USD"] as const),
            openingBalance: amount(input.openingBalance ?? "0", true),
            openingDate,
          },
        });
    await audit(
      tx,
      actor,
      current ? "account_updated" : "account_created",
      "TreasuryAccount",
      account.id,
    );
    return account;
  });
}

export type MovementInput = {
  accountId: string;
  direction: TreasuryMovementDirection;
  movementType: TreasuryMovementType;
  amount: ReturnType<typeof amount>;
  date: Date;
  description: string;
  reference?: string | null;
  sourceType: TreasurySourceType;
  sourceId: string;
  obligationId?: string | null;
  transferGroupId?: string;
  salePaymentId?: string;
  purchasePaymentId?: string;
  reversalOfId?: string;
};
export async function appendMovement(
  tx: Tx,
  actor: Actor,
  input: MovementInput,
) {
  if (!input.amount.gt(0))
    throw new TreasuryError("Monto de movimiento inválido.");
  await lock(tx, "TreasuryAccount", actor.tenantId, [input.accountId]);
  const account = await tx.treasuryAccount.findFirst({
    where: { id: input.accountId, tenantId: actor.tenantId, active: true },
  });
  if (!account) throw new TreasuryError("Cuenta inactiva o no disponible.");
  if (
    input.date < account.openingDate ||
    input.date.getTime() > Date.now() + 300000
  )
    throw new TreasuryError(
      "La fecha es anterior al saldo inicial o está en el futuro.",
    );
  if (
    await tx.bankReconciliation.count({
      where: {
        tenantId: actor.tenantId,
        bankAccountId: account.id,
        status: "COMPLETED",
        periodStart: { lte: input.date },
        periodEnd: { gt: input.date },
      },
    })
  )
    throw new TreasuryError("El período bancario está conciliado y cerrado.");
  const session =
    account.type === "CASH"
      ? await tx.cashSession.findFirst({
          where: {
            tenantId: actor.tenantId,
            cashAccountId: account.id,
            status: "OPEN",
          },
        })
      : null;
  if (
    account.type === "CASH" &&
    (!session ||
      input.date < session.openedAt ||
      input.date.getTime() > Date.now() + 300000)
  )
    throw new TreasuryError(
      "La caja requiere una sesión abierta y una fecha dentro de esa sesión.",
    );
  if (
    input.obligationId &&
    !(await tx.treasuryObligation.findFirst({
      where: { id: input.obligationId, tenantId: actor.tenantId },
    }))
  )
    throw new TreasuryError("Obligación no disponible.");
  if (
    input.direction === "OUT" &&
    input.movementType !== "CHECK_BOUNCED" &&
    (await accountBalance(tx, actor.tenantId, account.id)).lt(input.amount)
  )
    throw new TreasuryError("Saldo disponible insuficiente.");
  const movement = await tx.treasuryMovement.create({
    data: {
      ...input,
      tenantId: actor.tenantId,
      cashSessionId: session?.id,
      createdByUserId: actor.userId,
    },
  });
  await audit(tx, actor, "movement_created", "TreasuryMovement", movement.id, {
    amount: input.amount.toFixed(2),
    direction: input.direction,
    sourceType: input.sourceType,
  });
  return movement;
}

export async function manualMovement(
  actor: Actor,
  type: "CASH" | "BANK",
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const accountId = id(input.accountId);
    if (
      !(await tx.treasuryAccount.findFirst({
        where: { id: accountId, tenantId: actor.tenantId, type },
      }))
    )
      throw new TreasuryError("Cuenta no disponible.", 404);
    const direction = choice(input.direction, ["IN", "OUT"] as const);
    return appendMovement(tx, actor, {
      accountId,
      direction,
      movementType:
        type === "CASH"
          ? direction === "IN"
            ? "CASH_IN"
            : "CASH_OUT"
          : direction === "IN"
            ? "BANK_DEPOSIT"
            : "BANK_WITHDRAWAL",
      amount: amount(input.amount),
      date: input.date ? date(input.date) : new Date(),
      description: text(input.description, "Concepto")!,
      reference: text(input.reference, "Referencia", false),
      sourceType: "MANUAL",
      sourceId: id(input.requestKey),
    });
  });
}
export async function transfer(actor: Actor, input: Record<string, unknown>) {
  const sourceId = id(input.fromAccountId),
    targetId = id(input.toAccountId),
    requestKey = id(input.requestKey);
  if (sourceId === targetId)
    throw new TreasuryError("Selecciona dos cuentas diferentes.");
  return financialTransaction(async (tx) => {
    const existing = await tx.treasuryMovement.findMany({
      where: {
        tenantId: actor.tenantId,
        sourceType: "TRANSFER",
        sourceId: requestKey,
      },
    });
    if (existing.length) {
      if (existing.length !== 2)
        throw new TreasuryError("Transferencia inconsistente.", 409);
      return existing;
    }
    await lock(tx, "TreasuryAccount", actor.tenantId, [sourceId, targetId]);
    const accounts = await tx.treasuryAccount.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: [sourceId, targetId] },
        active: true,
        type: "BANK",
      },
    });
    if (accounts.length !== 2 || accounts[0].currency !== accounts[1].currency)
      throw new TreasuryError(
        "La transferencia requiere dos bancos activos con la misma moneda.",
      );
    const common = {
      amount: amount(input.amount),
      date: input.date ? date(input.date) : new Date(),
      description: text(
        input.description ?? "Transferencia interna",
        "Concepto",
      )!,
      reference: text(input.reference, "Referencia", false),
      movementType: "BANK_TRANSFER" as const,
      sourceType: "TRANSFER" as const,
      sourceId: requestKey,
      transferGroupId: randomUUID(),
    };
    const outgoing = await appendMovement(tx, actor, {
      ...common,
      accountId: sourceId,
      direction: "OUT",
    });
    const incoming = await appendMovement(tx, actor, {
      ...common,
      accountId: targetId,
      direction: "IN",
    });
    return [outgoing, incoming];
  });
}
export async function reverseManualMovement(
  actor: Actor,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const movementId = id(input.id);
    await lock(tx, "TreasuryMovement", actor.tenantId, [movementId]);
    const original = await tx.treasuryMovement.findFirst({
      where: { id: movementId, tenantId: actor.tenantId },
      include: { reversal: true },
    });
    if (
      !original ||
      original.sourceType !== "MANUAL" ||
      !["CASH_IN", "CASH_OUT", "BANK_DEPOSIT", "BANK_WITHDRAWAL"].includes(
        original.movementType,
      ) ||
      original.status !== "CONFIRMED"
    )
      throw new TreasuryError(
        "Este movimiento requiere corregir su operación de origen.",
      );
    if (original.reversal) return original.reversal;
    const reason = text(input.reason, "Motivo del reverso")!;
    const movement = await appendMovement(tx, actor, {
      accountId: original.accountId,
      direction: original.direction === "IN" ? "OUT" : "IN",
      movementType: "ADJUSTMENT",
      amount: original.amount,
      date: new Date(),
      description: `Reverso: ${reason}`,
      sourceType: "REVERSAL",
      sourceId: original.id,
      reversalOfId: original.id,
    });
    // Original remains in the balance; its compensating movement cancels its effect.
    await tx.treasuryMovement.update({
      where: { id: original.id },
      data: {
        cancelledByUserId: actor.userId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
    await audit(
      tx,
      actor,
      "movement_reversed",
      "TreasuryMovement",
      original.id,
      { reason, reversalId: movement.id },
    );
    return movement;
  });
}

export async function cashSession(
  actor: Actor,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const accountId = id(input.accountId);
    await lock(tx, "TreasuryAccount", actor.tenantId, [accountId]);
    const account = await tx.treasuryAccount.findFirst({
      where: {
        id: accountId,
        tenantId: actor.tenantId,
        type: "CASH",
        active: true,
      },
    });
    if (!account) throw new TreasuryError("Caja no disponible.", 404);
    const session = await tx.cashSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        cashAccountId: accountId,
        status: "OPEN",
      },
    });
    if (input.action === "open") {
      if (session)
        throw new TreasuryError("La caja ya tiene una sesión abierta.", 409);
      const opened = await tx.cashSession.create({
        data: {
          tenantId: actor.tenantId,
          cashAccountId: accountId,
          openedByUserId: actor.userId,
          openingAmount: await accountBalance(tx, actor.tenantId, accountId),
          notes: text(input.notes, "Notas", false, 2000),
        },
      });
      await audit(tx, actor, "cash_opened", "CashSession", opened.id);
      return opened;
    }
    if (input.action !== "close" || !session)
      throw new TreasuryError("No hay una sesión abierta para cerrar.");
    const expected = await accountBalance(tx, actor.tenantId, accountId);
    const counted = amount(input.countedAmount, true),
      difference = counted.minus(expected);
    const snapshot = await tx.cashClosing.create({
      data: {
        tenantId: actor.tenantId,
        date: new Date(),
        cashAccountName: account.name,
        expectedCashAmount: expected,
        expectedTotalAmount: expected,
        countedCashAmount: counted,
        differenceAmount: difference,
        createdByUserId: actor.userId,
        notes: text(input.notes, "Notas", false, 2000),
        status: "closed",
      },
    });
    const closed = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        closedAt: new Date(),
        closedByUserId: actor.userId,
        status: "CLOSED",
        expectedClosingAmount: expected,
        countedClosingAmount: counted,
        differenceAmount: difference,
        cashClosingId: snapshot.id,
      },
    });
    await audit(tx, actor, "cash_closed", "CashSession", closed.id, {
      expected: expected.toFixed(2),
      counted: counted.toFixed(2),
      difference: difference.toFixed(2),
    });
    return closed;
  });
}
