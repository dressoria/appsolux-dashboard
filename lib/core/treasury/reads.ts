import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Prisma, TreasuryMovementType } from "@prisma/client";
import { accountBalance } from "./db";
import {
  choice,
  date,
  money,
  localDay,
  nextDay,
  pageParams,
  signed,
  text,
  total,
} from "./domain";

export async function listAccounts(
  tenantId: string,
  type: "CASH" | "BANK" | "CARD",
  params: URLSearchParams,
) {
  const db = getPrismaClient(),
    pagination = pageParams(params);
  const where = {
    tenantId,
    type,
    ...(params.get("q")
      ? {
          name: {
            contains: text(params.get("q"), "Búsqueda")!,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };
  const [items, count] = await Promise.all([
    db.treasuryAccount.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: {
        sessions: {
          where: { tenantId },
          orderBy: { openedAt: "desc" },
          take: 1,
        },
      },
    }),
    db.treasuryAccount.count({ where }),
  ]);
  return {
    items: await Promise.all(
      items.map(async (item) => {
        const [balance, lastClosedSession] = await Promise.all([
          accountBalance(db, tenantId, item.id),
          type === "CASH"
            ? db.cashSession.findFirst({
                where: { tenantId, cashAccountId: item.id, status: "CLOSED" },
                orderBy: { closedAt: "desc" },
              })
            : Promise.resolve(null),
        ]);
        return {
          ...item,
          balance: money(balance),
          lastSession: item.sessions[0] ?? null,
          lastClosedSession,
        };
      }),
    ),
    total: count,
    ...pagination,
    totalPages: Math.ceil(count / pagination.pageSize),
  };
}
export async function listMovements(
  tenantId: string,
  type: "CASH" | "BANK" | "CARD",
  params: URLSearchParams,
) {
  const db = getPrismaClient(),
    pagination = pageParams(params);
  const where: Prisma.TreasuryMovementWhereInput = {
    tenantId,
    account: { tenantId, type },
    ...(params.get("accountId") ? { accountId: params.get("accountId")! } : {}),
  };
  if (params.get("from") || params.get("to"))
    where.date = {
      ...(params.get("from") ? { gte: date(params.get("from")) } : {}),
      ...(params.get("to") ? { lt: nextDay(date(params.get("to"))) } : {}),
    };
  if (params.get("direction"))
    where.direction = choice(params.get("direction"), ["IN", "OUT"] as const);
  if (params.get("status"))
    where.status = choice(params.get("status"), [
      "PENDING",
      "CONFIRMED",
      "CANCELLED",
      "RECONCILED",
    ] as const);
  if (params.get("movementType"))
    where.movementType = choice(
      params.get("movementType"),
      Object.values(TreasuryMovementType),
    );
  if (params.get("userId"))
    where.createdByUserId = text(params.get("userId"), "Usuario")!;
  if (params.get("q"))
    where.OR = [
      {
        reference: {
          contains: text(params.get("q"), "Referencia")!,
          mode: "insensitive",
        },
      },
      { description: { contains: params.get("q")!, mode: "insensitive" } },
    ];
  const [items, count] = await Promise.all([
    db.treasuryMovement.findMany({
      where,
      include: {
        account: { select: { name: true, type: true } },
        reversal: { select: { id: true } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    db.treasuryMovement.count({ where }),
  ]);
  const rows = await Promise.all(
    items.map(async (item) => {
      const balanceBefore = await accountBalance(
        db,
        tenantId,
        item.accountId,
        item.date,
      );
      const sameTime = await db.treasuryMovement.findMany({
        where: {
          tenantId,
          accountId: item.accountId,
          date: item.date,
          id: { lte: item.id },
          status: { in: ["CONFIRMED", "RECONCILED"] },
        },
        select: { direction: true, amount: true },
      });
      return {
        ...item,
        runningBalance: money(
          balanceBefore.plus(
            total(sameTime.map((m) => signed(m.direction, m.amount))),
          ),
        ),
      };
    }),
  );
  return {
    items: rows,
    total: count,
    ...pagination,
    totalPages: Math.ceil(count / pagination.pageSize),
  };
}
export async function listObligations(
  tenantId: string,
  type: "RECEIVABLE" | "PAYABLE",
  params: URLSearchParams,
) {
  const db = getPrismaClient(),
    pagination = pageParams(params),
    now = localDay();
  const where: Prisma.TreasuryObligationWhereInput = { tenantId, type };
  if (params.get("partyId"))
    Object.assign(
      where,
      type === "RECEIVABLE"
        ? { customerId: params.get("partyId") }
        : { supplierId: params.get("partyId") },
    );
  const status = params.get("status");
  if (status === "OVERDUE") {
    where.status = { notIn: ["PAID", "CANCELLED"] };
    where.dueDate = { lt: now };
    where.balance = { gt: 0 };
  } else if (status)
    where.status = choice(status, [
      "OPEN",
      "PARTIAL",
      "PAID",
      "CANCELLED",
    ] as const);
  if (params.get("due") === "soon") {
    where.status = { notIn: ["PAID", "CANCELLED"] };
    where.dueDate = { gte: now, lte: new Date(now.getTime() + 7 * 86400000) };
  }
  if (params.get("from") || params.get("to"))
    where.issueDate = {
      ...(params.get("from") ? { gte: date(params.get("from")) } : {}),
      ...(params.get("to") ? { lt: nextDay(date(params.get("to"))) } : {}),
    };
  if (params.get("q"))
    where.documentNumber = {
      contains: text(params.get("q"), "Documento")!,
      mode: "insensitive",
    };
  const [items, count] = await Promise.all([
    db.treasuryObligation.findMany({
      where,
      include: {
        customer: { select: { name: true, identification: true } },
        supplier: { select: { name: true, identification: true } },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    db.treasuryObligation.count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      ...item,
      daysOverdue:
        item.balance.gt(0) && item.status !== "CANCELLED"
          ? Math.max(
              0,
              Math.floor(
                (now.getTime() - localDay(item.dueDate).getTime()) / 86400000,
              ),
            )
          : 0,
      overdue:
        item.balance.gt(0) && item.status !== "CANCELLED" && item.dueDate < now,
    })),
    total: count,
    ...pagination,
    totalPages: Math.ceil(count / pagination.pageSize),
  };
}
export async function treasuryOptions(
  tenantId: string,
  params: URLSearchParams,
) {
  const db = getPrismaClient(),
    search = text(params.get("q"), "Búsqueda", false) ?? "";
  const [accounts, customers, suppliers, users] = await Promise.all([
    db.treasuryAccount.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
    db.lightweightCustomer.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { identification: { contains: search } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, identification: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.lightweightSupplier.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { identification: { contains: search } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, identification: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.membership.findMany({
      where: { tenantId, status: "active" },
      select: { user: { select: { id: true, name: true } } },
      take: 100,
    }),
  ]);
  return { accounts, customers, suppliers, users: users.map((m) => m.user) };
}
export async function listOther(
  tenantId: string,
  resource:
    | "checks"
    | "reconciliations"
    | "customer-advances"
    | "supplier-advances"
    | "card-transactions"
    | "cash-sessions",
  params: URLSearchParams,
) {
  const db = getPrismaClient(),
    pagination = pageParams(params),
    skip = (pagination.page - 1) * pagination.pageSize,
    take = pagination.pageSize;
  if (resource === "checks") {
    const where: Prisma.PostdatedCheckWhereInput = { tenantId };
    if (params.get("status"))
      where.status = choice(params.get("status"), [
        "PENDING",
        "READY_TO_DEPOSIT",
        "DEPOSITED",
        "CLEARED",
        "BOUNCED",
        "CANCELLED",
        "DELIVERED",
      ] as const);
    if (params.get("alert")) {
      const today = date(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Guayaquil",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      );
      const tomorrow = nextDay(today);
      where.status = { in: ["PENDING", "READY_TO_DEPOSIT", "DELIVERED"] };
      where.dueDate =
        params.get("alert") === "today"
          ? { gte: today, lt: tomorrow }
          : params.get("alert") === "overdue"
            ? { lt: today }
            : { gte: tomorrow, lt: new Date(today.getTime() + 8 * 86400000) };
    }
    const [items, count] = await Promise.all([
      db.postdatedCheck.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        skip,
        take,
      }),
      db.postdatedCheck.count({ where }),
    ]);
    return {
      items,
      total: count,
      ...pagination,
      totalPages: Math.ceil(count / take),
    };
  }
  if (resource === "reconciliations") {
    const where = {
      tenantId,
      ...(params.get("accountId")
        ? { bankAccountId: params.get("accountId")! }
        : {}),
    };
    const [items, count] = await Promise.all([
      db.bankReconciliation.findMany({
        where,
        include: { bankAccount: { select: { name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      db.bankReconciliation.count({ where }),
    ]);
    return {
      items,
      total: count,
      ...pagination,
      totalPages: Math.ceil(count / take),
    };
  }
  if (resource === "card-transactions") {
    const where: Prisma.CardTransactionWhereInput = { tenantId };
    if (params.get("status"))
      where.status = choice(params.get("status"), [
        "PENDING",
        "SETTLED",
        "REVERSED",
        "DISPUTED",
        "CANCELLED",
      ] as const);
    const [items, count] = await Promise.all([
      db.cardTransaction.findMany({
        where,
        include: {
          cardAccount: {
            select: {
              name: true,
              provider: true,
              settlementBankAccountId: true,
            },
          },
        },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      db.cardTransaction.count({ where }),
    ]);
    return {
      items,
      total: count,
      ...pagination,
      totalPages: Math.ceil(count / take),
    };
  }
  if (resource === "cash-sessions") {
    const where = {
      tenantId,
      ...(params.get("accountId")
        ? { cashAccountId: params.get("accountId")! }
        : {}),
    };
    const [items, count] = await Promise.all([
      db.cashSession.findMany({
        where,
        orderBy: [{ openedAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      db.cashSession.count({ where }),
    ]);
    return {
      items,
      total: count,
      ...pagination,
      totalPages: Math.ceil(count / take),
    };
  }
  const where: Prisma.TreasuryAdvanceWhereInput = {
    tenantId,
    type: resource === "customer-advances" ? "CUSTOMER" : "SUPPLIER",
  };
  if (params.get("status"))
    where.status = choice(params.get("status"), [
      "AVAILABLE",
      "PARTIALLY_APPLIED",
      "APPLIED",
      "CANCELLED",
    ] as const);
  const [items, count] = await Promise.all([
    db.treasuryAdvance.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        treasuryAccount: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    db.treasuryAdvance.count({ where }),
  ]);
  return {
    items,
    total: count,
    ...pagination,
    totalPages: Math.ceil(count / take),
  };
}
export async function treasurySummary(tenantId: string) {
  const db = getPrismaClient();
  const [accounts, obligations, advances, cards, checks] = await Promise.all([
    db.treasuryAccount.findMany({
      where: { tenantId, active: true },
      select: { id: true, type: true },
    }),
    db.treasuryObligation.groupBy({
      by: ["type"],
      where: { tenantId, status: { not: "CANCELLED" } },
      _sum: { balance: true },
    }),
    db.treasuryAdvance.groupBy({
      by: ["type"],
      where: { tenantId, status: { not: "CANCELLED" } },
      _sum: { balance: true },
    }),
    db.cardTransaction.aggregate({
      where: { tenantId, status: "PENDING" },
      _sum: { netAmount: true },
    }),
    db.postdatedCheck.count({
      where: {
        tenantId,
        status: { in: ["PENDING", "READY_TO_DEPOSIT", "DELIVERED"] },
        dueDate: { lte: new Date(Date.now() + 7 * 86400000) },
      },
    }),
  ]);
  const balances = await Promise.all(
    accounts.map(async (a) => ({
      type: a.type,
      balance: await accountBalance(db, tenantId, a.id),
    })),
  );
  return {
    cash: money(
      total(balances.filter((a) => a.type === "CASH").map((a) => a.balance)),
    ),
    banks: money(
      total(balances.filter((a) => a.type === "BANK").map((a) => a.balance)),
    ),
    pendingCards: money(cards._sum.netAmount ?? 0),
    receivables: money(
      obligations.find((o) => o.type === "RECEIVABLE")?._sum.balance ?? 0,
    ),
    payables: money(
      obligations.find((o) => o.type === "PAYABLE")?._sum.balance ?? 0,
    ),
    customerAdvances: money(
      advances.find((a) => a.type === "CUSTOMER")?._sum.balance ?? 0,
    ),
    supplierAdvances: money(
      advances.find((a) => a.type === "SUPPLIER")?._sum.balance ?? 0,
    ),
    dueChecks: checks,
  };
}
