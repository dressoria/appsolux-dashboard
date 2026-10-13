import "@/lib/security/server-only";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { TreasuryError, dec, signed } from "./domain";

export type Tx = Prisma.TransactionClient;
export type Actor = { tenantId: string; userId: string };
export async function financialTransaction<T>(
  operation: (tx: Tx) => Promise<T>,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPrismaClient().$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 20000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
}
const tables = [
  "TreasuryAccount",
  "TreasuryObligation",
  "TreasuryAdvance",
  "PostdatedCheck",
  "CardTransaction",
  "BankStatementLine",
  "TreasuryMovement",
  "BankReconciliation",
  "LightweightSale",
  "PurchaseDocument",
] as const;
export async function lock(
  tx: Tx,
  table: (typeof tables)[number],
  tenantId: string,
  ids: string[],
) {
  if (!tables.includes(table)) throw new TreasuryError("Tabla inválida.");
  const found = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${table}"`)} WHERE "tenantId" = ${tenantId} AND "id" IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY "id" FOR UPDATE`,
  );
  if (found.length !== new Set(ids).size)
    throw new TreasuryError("Registro no encontrado en esta empresa.", 404);
}
export async function accountBalance(
  tx: Tx,
  tenantId: string,
  accountId: string,
  before?: Date,
) {
  const account = await tx.treasuryAccount.findFirst({
    where: { id: accountId, tenantId },
  });
  if (!account) throw new TreasuryError("Cuenta no encontrada.", 404);
  const groups = await tx.treasuryMovement.groupBy({
    by: ["direction"],
    where: {
      tenantId,
      accountId,
      status: { in: ["CONFIRMED", "RECONCILED"] },
      ...(before ? { date: { lt: before } } : {}),
    },
    _sum: { amount: true },
  });
  return groups.reduce(
    (balance, group) =>
      balance.plus(signed(group.direction, group._sum.amount ?? 0)),
    dec(before && before < account.openingDate ? 0 : account.openingBalance),
  );
}
export async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  await tx.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: `treasury.${action}`,
      entityType,
      entityId,
      metadata,
    },
  });
}
export async function lockObligation(
  tx: Tx,
  tenantId: string,
  obligationId: string,
) {
  const source = await tx.treasuryObligation.findFirst({
    where: { id: obligationId, tenantId },
    select: { saleId: true, purchaseDocumentId: true },
  });
  if (!source) throw new TreasuryError("Obligación no encontrada.", 404);
  if (source.saleId)
    await lock(tx, "LightweightSale", tenantId, [source.saleId]);
  if (source.purchaseDocumentId)
    await lock(tx, "PurchaseDocument", tenantId, [source.purchaseDocumentId]);
  await lock(tx, "TreasuryObligation", tenantId, [obligationId]);
}
export async function party(
  tx: Tx,
  tenantId: string,
  type: "CUSTOMER" | "SUPPLIER",
  partyId: string,
) {
  const found =
    type === "CUSTOMER"
      ? await tx.lightweightCustomer.findFirst({
          where: { id: partyId, tenantId, isActive: true },
        })
      : await tx.lightweightSupplier.findFirst({
          where: { id: partyId, tenantId, isActive: true },
        });
  if (!found)
    throw new TreasuryError(
      "El tercero no pertenece a esta empresa o está inactivo.",
    );
  return found;
}
