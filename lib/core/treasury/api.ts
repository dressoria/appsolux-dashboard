import "@/lib/security/server-only";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  treasurySummary,
  treasuryOptions,
  listAccounts,
  listMovements,
  listObligations,
  listOther,
} from "./reads";
import {
  saveAccount,
  cashSession,
  manualMovement,
  transfer,
  reverseManualMovement,
} from "./accounts";
import {
  createObligation,
  collectOrPay,
  createAdvance,
  applyAdvance,
} from "./obligations";
import { createCheck, transitionCheck } from "./checks";
import { createCardCollection, settleCard } from "./cards";
import {
  readImportFile,
  readRows,
  previewObligations,
  confirmObligations,
} from "./imports";
import {
  createReconciliation,
  reconciliationDetail,
  statementPreview,
  importStatement,
  confirmMatch,
  completeReconciliation,
} from "./reconciliation";
import { allocateNewPayment, linkNewPurchasePayable } from "./integration";
import { id, pageParams, dec, money, TreasuryError } from "./domain";
import type { Actor } from "./db";

const dependencies = {
  authorize: async (): Promise<Actor | null> => {
    const { getCurrentUser } = await import("@/lib/auth/current-user");
    const user = await getCurrentUser();
    if (!user) return null;
    if (!user.tenant?.id)
      throw new TreasuryError(
        "Selecciona una empresa para acceder a Tesorería.",
        403,
      );
    const { getCurrentTenant } = await import("@/lib/tenant/current-tenant");
    const tenant = await getCurrentTenant(user);
    return { tenantId: tenant.id, userId: user.id };
  },
  operate: async (tenantId: string) => {
    const { requireTenantOperationalAccess } =
      await import("../tenant-operational-access");
    await requireTenantOperationalAccess(tenantId);
  },
};
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}
export async function treasuryApi(
  request: NextRequest,
  path: string,
  overrides: Partial<typeof dependencies> = {},
) {
  const services = { ...dependencies, ...overrides };
  try {
    const actor = await services.authorize();
    if (!actor) return json({ error: "Sesión requerida." }, 401);
    const params = request.nextUrl.searchParams;
    if (request.method === "GET") {
      if (path === "summary")
        return json(await treasurySummary(actor.tenantId));
      if (path === "options")
        return json(await treasuryOptions(actor.tenantId, params));
      if (["cash/accounts", "banks", "cards"].includes(path))
        return json(
          await listAccounts(
            actor.tenantId,
            path === "banks" ? "BANK" : path === "cards" ? "CARD" : "CASH",
            params,
          ),
        );
      if (["cash/movements", "banks/movements"].includes(path))
        return json(
          await listMovements(
            actor.tenantId,
            path.startsWith("cash") ? "CASH" : "BANK",
            params,
          ),
        );
      if (path === "receivables" || path === "payables")
        return json(
          await listObligations(
            actor.tenantId,
            path === "receivables" ? "RECEIVABLE" : "PAYABLE",
            params,
          ),
        );
      const others = {
        checks: "checks",
        "banks/reconciliations": "reconciliations",
        "advances/customers": "customer-advances",
        "advances/suppliers": "supplier-advances",
        "cards/transactions": "card-transactions",
        "cash/sessions": "cash-sessions",
      } as const;
      if (Object.hasOwn(others, path))
        return json(
          await listOther(
            actor.tenantId,
            others[path as keyof typeof others],
            params,
          ),
        );
      const detail = path.match(/^banks\/reconciliations\/([a-zA-Z0-9_-]+)$/);
      if (detail) {
        const page = pageParams(params);
        return json(
          await reconciliationDetail(
            actor.tenantId,
            id(detail[1]),
            page.page,
            page.pageSize,
          ),
        );
      }
      if (path === "sources") {
        const db = getPrismaClient(),
          pagination = pageParams(params);
        const activation = await db.treasuryAccount.findFirst({
          where: { tenantId: actor.tenantId },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        if (!activation)
          return json({ sales: [], purchases: [], activation: null });
        const [sales, purchases, unlinked] = await Promise.all([
          db.lightweightPayment.findMany({
            where: {
              createdAt: { gte: activation.createdAt },
              amount: { gt: 0 },
              method: { in: ["cash", "transfer", "card"] },
              sale: {
                tenantId: actor.tenantId,
                origin: "NORMAL",
                status: { not: "canceled" },
              },
              treasuryMovement: { is: null },
            },
            include: {
              sale: {
                select: { id: true, customer: { select: { name: true } } },
              },
            },
            orderBy: { createdAt: "desc" },
            skip: (pagination.page - 1) * pagination.pageSize,
            take: pagination.pageSize,
          }),
          db.purchasePayment.findMany({
            where: {
              createdAt: { gte: activation.createdAt },
              amount: { gt: 0 },
              method: { in: ["cash", "transfer"] },
              purchaseDocument: {
                tenantId: actor.tenantId,
                origin: "MANUAL",
                status: { in: ["REGISTERED", "AUTHORIZED"] },
              },
              treasuryMovement: { is: null },
            },
            include: {
              purchaseDocument: {
                select: { supplierDocumentNumber: true, supplierName: true },
              },
            },
            orderBy: { createdAt: "desc" },
            skip: (pagination.page - 1) * pagination.pageSize,
            take: pagination.pageSize,
          }),
          db.purchaseDocument.findMany({
            where: {
              tenantId: actor.tenantId,
              origin: "MANUAL",
              createdAt: { gte: activation.createdAt },
              status: { in: ["REGISTERED", "AUTHORIZED"] },
              documentType: {
                in: ["INVOICE", "DEBIT_NOTE", "PURCHASE_SETTLEMENT"],
              },
              treasuryObligation: { is: null },
            },
            include: { payments: true },
            orderBy: { createdAt: "desc" },
            skip: (pagination.page - 1) * pagination.pageSize,
            take: pagination.pageSize,
          }),
        ]);
        return json({
          sales,
          purchases,
          hasMore:
            sales.length === pagination.pageSize ||
            purchases.length === pagination.pageSize ||
            unlinked.length === pagination.pageSize,
          unlinkedPurchases: unlinked
            .map((p) => ({
              id: p.id,
              supplierName: p.supplierName,
              supplierIdentification: p.supplierIdentification,
              documentNumber: p.supplierDocumentNumber,
              remainingBalance: money(
                p.total.minus(
                  p.payments.reduce(
                    (sum, payment) => sum.plus(payment.amount),
                    dec(0),
                  ),
                ),
              ),
            }))
            .filter((p) => dec(p.remainingBalance).gt(0)),
          activation: activation.createdAt,
          ...pagination,
        });
      }
      return json({ error: "Ruta no encontrada." }, 404);
    }
    const preview =
      path === "obligations/import/preview" ||
      path === "banks/statements/preview";
    if (!preview) await services.operate(actor.tenantId);
    if (preview && request.method === "POST") {
      let rows, reconciliationId: unknown;
      if (
        request.headers.get("content-type")?.includes("multipart/form-data")
      ) {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File))
          throw new TreasuryError("Selecciona un archivo CSV o XLSX.");
        rows = await readImportFile(file);
        reconciliationId = form.get("reconciliationId");
      } else {
        const body = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new TreasuryError("Preview inválido.");
        rows = readRows(body.rows);
        reconciliationId = body.reconciliationId;
      }
      return json(
        path.startsWith("obligations")
          ? await previewObligations(actor.tenantId, rows)
          : await statementPreview(actor.tenantId, id(reconciliationId), rows),
      );
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new TreasuryError("Solicitud inválida.");
    const input = body as Record<string, unknown>;
    // tenantId, balances and paid amounts supplied by clients never become authority.
    if (
      ["cash/accounts", "banks", "cards"].includes(path) &&
      ["POST", "PATCH"].includes(request.method)
    )
      return json(
        await saveAccount(
          actor,
          path === "banks" ? "BANK" : path === "cards" ? "CARD" : "CASH",
          input,
        ),
      );
    if (request.method !== "POST")
      return json({ error: "Método no permitido." }, 405);
    if (path === "cash/sessions") return json(await cashSession(actor, input));
    if (["cash/movements", "banks/movements"].includes(path))
      return json(
        await manualMovement(
          actor,
          path.startsWith("cash") ? "CASH" : "BANK",
          input,
        ),
      );
    if (path === "banks/transfers") return json(await transfer(actor, input));
    if (path === "movements/reverse")
      return json(await reverseManualMovement(actor, input));
    if (path === "checks") return json(await createCheck(actor, input));
    if (path === "receivables" || path === "payables")
      return json(
        await createObligation(
          actor,
          path === "receivables" ? "RECEIVABLE" : "PAYABLE",
          input,
        ),
      );
    if (path === "obligations/import/confirm")
      return json(await confirmObligations(actor, readRows(input.rows)));
    if (path === "banks/reconciliations")
      return json(await createReconciliation(actor, input));
    if (path === "banks/statements/confirm")
      return json(
        await importStatement(
          actor,
          id(input.reconciliationId),
          readRows(input.rows),
        ),
      );
    if (path === "banks/reconciliations/match")
      return json(await confirmMatch(actor, input));
    if (path === "advances/customers" || path === "advances/suppliers")
      return json(
        await createAdvance(
          actor,
          path.endsWith("customers") ? "CUSTOMER" : "SUPPLIER",
          input,
        ),
      );
    if (path === "cards/transactions")
      return json(await createCardCollection(actor, input));
    if (path === "sources/allocate")
      return json(await allocateNewPayment(actor, input));
    if (path === "sources/create-payable")
      return json(await linkNewPurchasePayable(actor, input));
    const obligation = path.match(
      /^(receivables|payables)\/([a-zA-Z0-9_-]+)\/(collect|pay)$/,
    );
    if (
      obligation &&
      (obligation[1] === "receivables"
        ? obligation[3] === "collect"
        : obligation[3] === "pay")
    )
      return json(
        await collectOrPay(
          actor,
          id(obligation[2]),
          obligation[1] === "receivables" ? "RECEIVABLE" : "PAYABLE",
          input,
        ),
      );
    const advance = path.match(/^advances\/([a-zA-Z0-9_-]+)\/apply$/);
    if (advance) return json(await applyAdvance(actor, id(advance[1]), input));
    const card = path.match(/^cards\/transactions\/([a-zA-Z0-9_-]+)\/settle$/);
    if (card) return json(await settleCard(actor, id(card[1]), input));
    const check = path.match(/^checks\/([a-zA-Z0-9_-]+)\/transition$/);
    if (check) return json(await transitionCheck(actor, id(check[1]), input));
    const reconciliation = path.match(
      /^banks\/reconciliations\/([a-zA-Z0-9_-]+)\/complete$/,
    );
    if (reconciliation)
      return json(await completeReconciliation(actor, id(reconciliation[1])));
    return json({ error: "Ruta no encontrada." }, 404);
  } catch (error) {
    if (error instanceof TreasuryError)
      return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError || error instanceof RangeError)
      return json({ error: "Solicitud o fecha inválida." }, 400);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021" || error.code === "P2022")
        return json(
          {
            error:
              "Tesorería requiere la migración pendiente. No se ejecutaron migraciones durante esta implementación.",
            code: "TREASURY_MIGRATION_PENDING",
          },
          503,
        );
      if (["P2002", "P2034"].includes(error.code))
        return json(
          {
            error:
              "La operación ya existe o cambió durante la confirmación. Actualiza la vista antes de reintentar.",
          },
          409,
        );
      if (error.code === "P2025")
        return json({ error: "Registro no encontrado en esta empresa." }, 404);
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "TENANT_OPERATION_SUSPENDED"
    )
      return json(
        {
          error: error instanceof Error ? error.message : "Tenant suspendido.",
          code: error.code,
        },
        403,
      );
    console.error(
      "[treasury] request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      { error: "No se pudo completar la operación de Tesorería." },
      500,
    );
  }
}
