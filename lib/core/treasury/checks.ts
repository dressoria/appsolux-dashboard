import "@/lib/security/server-only";
import { appendMovement } from "./accounts";
import { recordObligationPayment } from "./obligations";
import {
  audit,
  financialTransaction,
  lock,
  lockObligation,
  party,
  type Actor,
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

export async function createCheck(
  actor: Actor,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const direction = choice(input.direction, [
      "RECEIVABLE",
      "PAYABLE",
    ] as const);
    const obligationId = input.obligationId ? id(input.obligationId) : null;
    const obligation = obligationId
      ? await tx.treasuryObligation.findFirst({
          where: {
            id: obligationId,
            tenantId: actor.tenantId,
            type: direction,
            status: { notIn: ["PAID", "CANCELLED"] },
          },
        })
      : null;
    if (obligationId && !obligation)
      throw new TreasuryError("Obligación no disponible.");
    const partyId = input.partyId
      ? id(input.partyId)
      : direction === "RECEIVABLE"
        ? obligation?.customerId
        : obligation?.supplierId;
    if (partyId)
      await party(
        tx,
        actor.tenantId,
        direction === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER",
        partyId,
      );
    if (
      obligation &&
      partyId !==
        (direction === "RECEIVABLE"
          ? obligation.customerId
          : obligation.supplierId)
    )
      throw new TreasuryError("Tercero incompatible con la obligación.");
    const issueDate = date(input.issueDate),
      dueDate = date(input.dueDate),
      value = amount(input.amount);
    if (dueDate < issueDate || (obligation && value.gt(obligation.balance)))
      throw new TreasuryError("Fecha o monto del cheque inválido.");
    const check = await tx.postdatedCheck.create({
      data: {
        tenantId: actor.tenantId,
        direction,
        checkNumber: text(input.checkNumber, "Número de cheque")!,
        bankName: text(input.bankName, "Banco")!,
        issuerName: text(input.issuerName, "Emisor")!,
        issuerIdentification: text(
          input.issuerIdentification,
          "Identificación",
          false,
        ),
        beneficiaryName: text(input.beneficiaryName, "Beneficiario", false),
        bankAccountNumberMasked: input.bankLastFour
          ? `****${choiceLastFour(input.bankLastFour)}`
          : null,
        amount: value,
        issueDate,
        dueDate,
        obligationId,
        customerId: direction === "RECEIVABLE" ? partyId : null,
        supplierId: direction === "PAYABLE" ? partyId : null,
        notes: text(input.notes, "Notas", false, 2000),
        createdByUserId: actor.userId,
      },
    });
    await audit(tx, actor, "check_created", "PostdatedCheck", check.id);
    return check;
  });
}
function choiceLastFour(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}$/.test(value))
    throw new TreasuryError("Ingresa únicamente los últimos cuatro dígitos.");
  return value;
}
export async function transitionCheck(
  actor: Actor,
  checkId: string,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    await lock(tx, "PostdatedCheck", actor.tenantId, [checkId]);
    const check = await tx.postdatedCheck.findFirst({
      where: { id: checkId, tenantId: actor.tenantId },
    });
    if (!check) throw new TreasuryError("Cheque no encontrado.", 404);
    const status = choice(input.status, [
      "READY_TO_DEPOSIT",
      "DEPOSITED",
      "CLEARED",
      "BOUNCED",
      "CANCELLED",
      "DELIVERED",
    ] as const);
    if (check.status === status) return check;
    const allowed: Record<string, string[]> =
      check.direction === "RECEIVABLE"
        ? {
            PENDING: ["READY_TO_DEPOSIT", "DEPOSITED", "CANCELLED"],
            READY_TO_DEPOSIT: ["DEPOSITED", "CANCELLED"],
            DEPOSITED: ["CLEARED", "BOUNCED"],
            CLEARED: ["BOUNCED"],
          }
        : {
            PENDING: ["DELIVERED", "CANCELLED"],
            DELIVERED: ["CLEARED", "BOUNCED", "CANCELLED"],
            CLEARED: ["BOUNCED"],
          };
    if (!allowed[check.status]?.includes(status))
      throw new TreasuryError("Transición de cheque no permitida.");
    if (
      ["READY_TO_DEPOSIT", "DEPOSITED", "CLEARED"].includes(status) &&
      check.dueDate > new Date()
    )
      throw new TreasuryError(
        "El cheque aún no alcanza su fecha de vencimiento.",
      );
    if (status === "CLEARED") {
      const accountId = id(input.accountId);
      if (
        !(await tx.treasuryAccount.findFirst({
          where: {
            id: accountId,
            tenantId: actor.tenantId,
            type: "BANK",
            active: true,
          },
        }))
      )
        throw new TreasuryError("Selecciona una cuenta bancaria activa.");
      if (check.obligationId)
        await lockObligation(tx, actor.tenantId, check.obligationId);
      const obligation = check.obligationId
        ? await tx.treasuryObligation.findFirst({
            where: { id: check.obligationId, tenantId: actor.tenantId },
          })
        : null;
      const payment = obligation
        ? await recordObligationPayment(
            tx,
            actor,
            obligation,
            check.amount,
            "transfer",
            new Date(),
            `Cheque ${check.checkNumber}`,
          )
        : null;
      await appendMovement(tx, actor, {
        accountId,
        amount: check.amount,
        date: new Date(),
        direction: check.direction === "RECEIVABLE" ? "IN" : "OUT",
        movementType: "CHECK_CLEARED",
        sourceType: "CHECK",
        sourceId: check.id,
        description: `Clearing cheque ${check.checkNumber}`,
        obligationId: check.obligationId,
        salePaymentId: payment?.salePaymentId,
        purchasePaymentId: payment?.purchasePaymentId,
      });
    }
    if (status === "BOUNCED" && check.status === "CLEARED") {
      const reason = text(input.reason, "Motivo de devolución")!;
      const original = await tx.treasuryMovement.findFirst({
        where: {
          tenantId: actor.tenantId,
          sourceType: "CHECK",
          sourceId: check.id,
          movementType: "CHECK_CLEARED",
        },
      });
      if (!original)
        throw new TreasuryError("Movimiento de clearing no encontrado.");
      let salePaymentId: string | undefined,
        purchasePaymentId: string | undefined;
      if (check.obligationId) {
        await lockObligation(tx, actor.tenantId, check.obligationId);
        const obligation = await tx.treasuryObligation.findFirstOrThrow({
          where: { id: check.obligationId, tenantId: actor.tenantId },
        });
        const paid = obligation.paidAmount.minus(check.amount);
        if (paid.lt(0))
          throw new TreasuryError(
            "Saldo de cartera inconsistente para devolver el cheque.",
            409,
          );
        if (obligation.saleId) {
          await tx.$queryRaw`SELECT "id" FROM "LightweightSale" WHERE "id"=${obligation.saleId} AND "tenantId"=${actor.tenantId} FOR UPDATE`;
          const sale = await tx.lightweightSale.findFirstOrThrow({
            where: { id: obligation.saleId, tenantId: actor.tenantId },
            include: { payments: true },
          });
          const rawPaid = sale.payments
            .reduce((sum, p) => sum.plus(p.amount), dec(0))
            .minus(check.amount);
          const payment = await tx.lightweightPayment.create({
            data: {
              saleId: sale.id,
              method: "transfer",
              amount: check.amount.negated(),
            },
          });
          salePaymentId = payment.id;
          await tx.lightweightSale.update({
            where: { id: sale.id },
            data: {
              status: "open",
              paymentStatus: rawPaid.gt(0) ? "partial" : "pending",
            },
          });
          if (sale.customerId)
            await tx.lightweightCustomer.updateMany({
              where: { id: sale.customerId, tenantId: actor.tenantId },
              data: { balance: { increment: check.amount } },
            });
        }
        if (obligation.purchaseDocumentId) {
          const payment = await tx.purchasePayment.create({
            data: {
              purchaseDocumentId: obligation.purchaseDocumentId,
              method: "transfer",
              amount: check.amount.negated(),
              notes: `Devolución cheque ${check.checkNumber}: ${reason}`,
            },
          });
          purchasePaymentId = payment.id;
        }
        await tx.treasuryObligation.update({
          where: { id: obligation.id },
          data: {
            paidAmount: paid,
            ...obligationState(
              obligation.originalAmount,
              paid,
              obligation.dueDate,
            ),
          },
        });
      }
      await appendMovement(tx, actor, {
        accountId: original.accountId,
        amount: check.amount,
        date: new Date(),
        direction: original.direction === "IN" ? "OUT" : "IN",
        movementType: "CHECK_BOUNCED",
        description: `Cheque devuelto: ${reason}`,
        sourceType: "CHECK",
        sourceId: check.id,
        reversalOfId: original.id,
        obligationId: check.obligationId,
        salePaymentId,
        purchasePaymentId,
      });
      await tx.treasuryMovement.update({
        where: { id: original.id },
        data: {
          cancelledByUserId: actor.userId,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });
    }
    const updated = await tx.postdatedCheck.update({
      where: { id: check.id },
      data: { status },
    });
    await audit(tx, actor, "check_transition", "PostdatedCheck", check.id, {
      from: check.status,
      to: status,
    });
    return updated;
  });
}
