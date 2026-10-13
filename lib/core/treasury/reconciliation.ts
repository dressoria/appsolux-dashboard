import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { getEcuadorSriDateParts } from "../sri-ecuador-date";
import {
  accountBalance,
  audit,
  financialTransaction,
  lock,
  type Actor,
} from "./db";
import {
  amount,
  date,
  dec,
  id,
  nextDay,
  signed,
  total,
  TreasuryError,
} from "./domain";
import { previewStatement, type ImportRow } from "./imports";

function calendarDay(value: Date) {
  const p = getEcuadorSriDateParts(value);
  return Date.parse(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
}
export function matchCandidates(
  line: {
    amount: { toString(): string };
    direction: string;
    date: Date;
    reference: string | null;
  },
  movements: {
    id: string;
    amount: { toString(): string };
    direction: string;
    date: Date;
    reference: string | null;
  }[],
  tolerance: number,
) {
  const reference = (value: string | null) => value?.trim().toUpperCase() ?? "";
  const candidates = movements
    .filter(
      (m) =>
        m.direction === line.direction &&
        dec(m.amount.toString()).eq(line.amount.toString()) &&
        Math.abs(calendarDay(m.date) - calendarDay(line.date)) <=
          tolerance * 86400000,
    )
    .map((m) => ({
      id: m.id,
      date: m.date,
      reference: m.reference,
      exact:
        calendarDay(m.date) === calendarDay(line.date) &&
        !!reference(line.reference) &&
        reference(m.reference) === reference(line.reference),
    }));
  const exactCount = candidates.filter((c) => c.exact).length;
  return candidates.map((c) => ({
    ...c,
    match: c.exact && exactCount === 1 ? "EXACT" : "POSSIBLE",
  }));
}
export async function createReconciliation(
  actor: Actor,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const bankAccountId = id(input.accountId),
      periodStart = date(input.periodStart),
      periodEnd = nextDay(date(input.periodEnd));
    if (
      periodStart >= periodEnd ||
      periodEnd.getTime() - periodStart.getTime() > 366 * 86400000
    )
      throw new TreasuryError("Período bancario inválido; máximo un año.");
    await lock(tx, "TreasuryAccount", actor.tenantId, [bankAccountId]);
    if (
      !(await tx.treasuryAccount.findFirst({
        where: {
          id: bankAccountId,
          tenantId: actor.tenantId,
          type: "BANK",
          active: true,
        },
      }))
    )
      throw new TreasuryError("Banco no disponible.");
    if (
      await tx.bankReconciliation.count({
        where: {
          tenantId: actor.tenantId,
          bankAccountId,
          status: { not: "CANCELLED" },
          periodStart: { lt: periodEnd },
          periodEnd: { gt: periodStart },
        },
      })
    )
      throw new TreasuryError(
        "Existe una conciliación que se superpone con este período.",
        409,
      );
    const systemOpeningBalance = await accountBalance(
        tx,
        actor.tenantId,
        bankAccountId,
        periodStart,
      ),
      systemClosingBalance = await accountBalance(
        tx,
        actor.tenantId,
        bankAccountId,
        periodEnd,
      );
    const statementOpeningBalance = amount(
        input.statementOpeningBalance,
        true,
        true,
      ),
      statementClosingBalance = amount(
        input.statementClosingBalance,
        true,
        true,
      );
    const dateToleranceDays = Number(input.dateToleranceDays ?? 2);
    if (
      !Number.isInteger(dateToleranceDays) ||
      dateToleranceDays < 0 ||
      dateToleranceDays > 7
    )
      throw new TreasuryError("Tolerancia de fecha inválida.");
    const reconciliation = await tx.bankReconciliation.create({
      data: {
        tenantId: actor.tenantId,
        bankAccountId,
        periodStart,
        periodEnd,
        dateToleranceDays,
        statementOpeningBalance,
        statementClosingBalance,
        systemOpeningBalance,
        systemClosingBalance,
        difference: statementClosingBalance.minus(systemClosingBalance),
        createdByUserId: actor.userId,
      },
    });
    await audit(
      tx,
      actor,
      "reconciliation_created",
      "BankReconciliation",
      reconciliation.id,
    );
    return reconciliation;
  });
}
export async function statementPreview(
  tenantId: string,
  reconciliationId: string,
  rows: ImportRow[],
) {
  const db = getPrismaClient();
  const reconciliation = await db.bankReconciliation.findFirst({
    where: {
      id: reconciliationId,
      tenantId,
      status: { in: ["DRAFT", "IN_PROGRESS"] },
    },
  });
  if (!reconciliation)
    throw new TreasuryError("Conciliación no disponible.", 404);
  return previewStatement(
    rows,
    reconciliation.periodStart,
    reconciliation.periodEnd,
  );
}
export async function importStatement(
  actor: Actor,
  reconciliationId: string,
  rows: ImportRow[],
) {
  return financialTransaction(async (tx) => {
    await lock(tx, "BankReconciliation", actor.tenantId, [reconciliationId]);
    const reconciliation = await tx.bankReconciliation.findFirst({
      where: {
        id: reconciliationId,
        tenantId: actor.tenantId,
        status: { in: ["DRAFT", "IN_PROGRESS"] },
      },
    });
    if (!reconciliation) throw new TreasuryError("Conciliación no disponible.");
    const preview = previewStatement(
      rows,
      reconciliation.periodStart,
      reconciliation.periodEnd,
    );
    if (!preview.valid)
      throw new TreasuryError(
        preview.errors.map((e) => `Fila ${e.row}: ${e.message}`).join("; "),
      );
    const result = await tx.bankStatementLine.createMany({
      data: preview.lines.map((line) => ({
        ...line,
        tenantId: actor.tenantId,
        bankAccountId: reconciliation.bankAccountId,
        reconciliationId,
      })),
      skipDuplicates: true,
    });
    await tx.bankReconciliation.update({
      where: { id: reconciliation.id },
      data: { status: "IN_PROGRESS" },
    });
    await audit(
      tx,
      actor,
      "statement_imported",
      "BankReconciliation",
      reconciliation.id,
      { imported: result.count, skipped: rows.length - result.count },
    );
    return { imported: result.count, skipped: rows.length - result.count };
  });
}
export async function reconciliationDetail(
  tenantId: string,
  reconciliationId: string,
  page: number,
  pageSize: number,
) {
  const db = getPrismaClient();
  const reconciliation = await db.bankReconciliation.findFirst({
    where: { id: reconciliationId, tenantId },
    include: { bankAccount: true },
  });
  if (!reconciliation)
    throw new TreasuryError("Conciliación no encontrada.", 404);
  const [lines, count, movements] = await Promise.all([
    db.bankStatementLine.findMany({
      where: { tenantId, reconciliationId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.bankStatementLine.count({ where: { tenantId, reconciliationId } }),
    db.treasuryMovement.findMany({
      where: {
        tenantId,
        accountId: reconciliation.bankAccountId,
        status: "CONFIRMED",
        date: {
          gte: new Date(
            reconciliation.periodStart.getTime() -
              reconciliation.dateToleranceDays * 86400000,
          ),
          lt: new Date(
            reconciliation.periodEnd.getTime() +
              reconciliation.dateToleranceDays * 86400000,
          ),
        },
        statementLine: { is: null },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    reconciliation,
    items: lines.map((line) => ({
      ...line,
      candidates:
        line.status === "UNMATCHED"
          ? matchCandidates(line, movements, reconciliation.dateToleranceDays)
          : [],
    })),
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}
export async function confirmMatch(
  actor: Actor,
  input: Record<string, unknown>,
) {
  return financialTransaction(async (tx) => {
    const lineId = id(input.lineId),
      movementId = id(input.movementId);
    await lock(tx, "BankStatementLine", actor.tenantId, [lineId]);
    const line = await tx.bankStatementLine.findFirst({
      where: { id: lineId, tenantId: actor.tenantId },
      include: { reconciliation: true },
    });
    if (!line || !["DRAFT", "IN_PROGRESS"].includes(line.reconciliation.status))
      throw new TreasuryError("Línea no disponible.");
    if (line.matchedMovementId === movementId) return line;
    if (line.status !== "UNMATCHED")
      throw new TreasuryError("La línea ya está conciliada.", 409);
    await lock(tx, "TreasuryAccount", actor.tenantId, [line.bankAccountId]);
    await lock(tx, "TreasuryMovement", actor.tenantId, [movementId]);
    const movement = await tx.treasuryMovement.findFirst({
      where: {
        id: movementId,
        tenantId: actor.tenantId,
        accountId: line.bankAccountId,
        status: "CONFIRMED",
        statementLine: { is: null },
      },
    });
    if (
      !movement ||
      !matchCandidates(line, [movement], line.reconciliation.dateToleranceDays)
        .length
    )
      throw new TreasuryError(
        "El movimiento no coincide o ya fue conciliado.",
        409,
      );
    await tx.treasuryMovement.update({
      where: { id: movement.id },
      data: { status: "RECONCILED" },
    });
    const matched = await tx.bankStatementLine.update({
      where: { id: line.id },
      data: { status: "MATCHED", matchedMovementId: movement.id },
    });
    await audit(tx, actor, "statement_matched", "BankStatementLine", line.id, {
      movementId,
    });
    return matched;
  });
}
export async function completeReconciliation(
  actor: Actor,
  reconciliationId: string,
) {
  return financialTransaction(async (tx) => {
    await lock(tx, "BankReconciliation", actor.tenantId, [reconciliationId]);
    const reconciliation = await tx.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId: actor.tenantId },
    });
    if (!reconciliation)
      throw new TreasuryError("Conciliación no encontrada.", 404);
    if (reconciliation.status === "COMPLETED") return reconciliation;
    if (reconciliation.status === "CANCELLED")
      throw new TreasuryError("Conciliación cancelada.");
    await lock(tx, "TreasuryAccount", actor.tenantId, [
      reconciliation.bankAccountId,
    ]);
    const lines = await tx.bankStatementLine.findMany({
      where: { tenantId: actor.tenantId, reconciliationId },
    });
    if (lines.some((l) => l.status !== "MATCHED"))
      throw new TreasuryError("Hay líneas bancarias sin conciliar.");
    const statementCalculated = reconciliation.statementOpeningBalance.plus(
      total(lines.map((l) => signed(l.direction, l.amount))),
    );
    if (!statementCalculated.eq(reconciliation.statementClosingBalance))
      throw new TreasuryError(
        "Las líneas importadas no cuadran con los saldos del estado de cuenta.",
      );
    const unmatched = await tx.treasuryMovement.findMany({
      where: {
        tenantId: actor.tenantId,
        accountId: reconciliation.bankAccountId,
        date: { gte: reconciliation.periodStart, lt: reconciliation.periodEnd },
        status: { in: ["CONFIRMED", "RECONCILED"] },
        OR: [
          { statementLine: { is: null } },
          {
            statementLine: {
              is: { reconciliationId: { not: reconciliationId } },
            },
          },
        ],
      },
      include: {
        statementLine: true,
        reversal: { include: { statementLine: true } },
        reversalOf: { include: { statementLine: true } },
      },
    });
    const internalOffsetPairs = new Set<string>();
    const unresolved = unmatched.filter((movement) => {
      if (movement.statementLine) return true;
      const other =
        movement.sourceType === "REVERSAL" &&
        movement.reversalOf?.sourceType === "MANUAL"
          ? movement.reversalOf
          : movement.sourceType === "MANUAL"
            ? movement.reversal
            : null;
      if (
        other &&
        !other.statementLine &&
        other.accountId === movement.accountId &&
        other.amount.eq(movement.amount) &&
        other.direction !== movement.direction &&
        ["CONFIRMED", "RECONCILED"].includes(other.status) &&
        other.date >= reconciliation.periodStart &&
        other.date < reconciliation.periodEnd
      ) {
        internalOffsetPairs.add([movement.id, other.id].sort().join(":"));
        return false;
      }
      return true;
    });
    if (unresolved.length)
      throw new TreasuryError(
        "Hay movimientos del sistema pendientes de conciliar en este período.",
      );
    const systemOpeningBalance = await accountBalance(
        tx,
        actor.tenantId,
        reconciliation.bankAccountId,
        reconciliation.periodStart,
      ),
      systemClosingBalance = await accountBalance(
        tx,
        actor.tenantId,
        reconciliation.bankAccountId,
        reconciliation.periodEnd,
      ),
      difference =
        reconciliation.statementClosingBalance.minus(systemClosingBalance);
    if (
      !difference.isZero() ||
      !systemOpeningBalance.eq(reconciliation.statementOpeningBalance)
    )
      throw new TreasuryError(
        "Los saldos de apertura/cierre difieren entre el banco y el sistema.",
      );
    const result = await tx.bankReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: "COMPLETED",
        systemOpeningBalance,
        systemClosingBalance,
        difference,
        completedAt: new Date(),
      },
    });
    await audit(
      tx,
      actor,
      "reconciliation_completed",
      "BankReconciliation",
      result.id,
      { internalOffsetPairs: [...internalOffsetPairs] },
    );
    return result;
  });
}
