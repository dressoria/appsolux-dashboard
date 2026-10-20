// Transactional in-memory adapter for service tests. It never connects to a DB
// or executes migration SQL. Database constraints are also reviewed in SQL.
import { Prisma, type PrismaClient } from "@prisma/client";
import type { TestContext } from "node:test";
type R = Record<string, unknown>;
type State = Record<string, R[]>;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
function copy<T>(value: T): T {
  if (value instanceof Prisma.Decimal) return D(value) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map(copy) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, copy(v)]),
    ) as T;
  return value;
}
function compare(a: unknown, b: unknown) {
  if (a instanceof Prisma.Decimal || b instanceof Prisma.Decimal)
    return D(String(a ?? 0)).cmp(String(b ?? 0));
  if (a instanceof Date || b instanceof Date)
    return new Date(a as string).getTime() - new Date(b as string).getTime();
  return a === b ? 0 : (a as string) < (b as string) ? -1 : 1;
}
export function treasuryStore(t: TestContext, additionalTables: string[] = []) {
  let state: State = {},
    sequence = 0,
    txCount = 0,
    queue = Promise.resolve();
  const tables = [
    "treasuryAccount",
    "treasuryMovement",
    "cashSession",
    "cashClosing",
    "treasuryObligation",
    "treasuryAdvance",
    "advanceApplication",
    "postdatedCheck",
    "cardTransaction",
    "bankReconciliation",
    "bankStatementLine",
    "lightweightCustomer",
    "lightweightSupplier",
    "lightweightSale",
    "lightweightPayment",
    "purchaseDocument",
    "purchasePayment",
    "auditLog",
    "membership",
    ...additionalTables,
  ];
  for (const table of tables) state[table] = [];
  const failures = new Map<string, number>();
  const rel = (
    model: string,
    row: R,
    key: string,
  ): { model: string; rows: R[]; many?: boolean } | null => {
    const one = (target: string, keyValue: unknown) => ({
      model: target,
      rows: state[target].filter((r) => r.id === keyValue),
    });
    if (key === "account") return one("treasuryAccount", row.accountId);
    if (key === "sriDocument") return one("sriDocument", row.sriDocumentId);
    if (key === "cancellationRequests") return {
      model: "sriCancellationRequest",
      rows: state.sriCancellationRequest.filter((r) => r.sriDocumentId === row.id),
      many: true,
    };
    if (key === "cashAccount") return one("treasuryAccount", row.cashAccountId);
    if (key === "bankAccount") return one("treasuryAccount", row.bankAccountId);
    if (key === "cardAccount") return one("treasuryAccount", row.cardAccountId);
    if (key === "treasuryAccount")
      return one("treasuryAccount", row.treasuryAccountId);
    if (key === "obligation")
      return one("treasuryObligation", row.obligationId);
    if (key === "reconciliation")
      return one("bankReconciliation", row.reconciliationId);
    if (key === "customer") return one("lightweightCustomer", row.customerId);
    if (key === "supplier") return one("lightweightSupplier", row.supplierId);
    if (key === "sale") return one("lightweightSale", row.saleId);
    if (key === "salePayment")
      return one("lightweightPayment", row.salePaymentId);
    if (key === "purchasePayment")
      return one("purchasePayment", row.purchasePaymentId);
    if (key === "purchaseDocument")
      return one("purchaseDocument", row.purchaseDocumentId);
    if (key === "reversalOf") return one("treasuryMovement", row.reversalOfId);
    if (key === "reversal")
      return {
        model: "treasuryMovement",
        rows: state.treasuryMovement.filter((r) => r.reversalOfId === row.id),
      };
    if (key === "statementLine")
      return {
        model: "bankStatementLine",
        rows: state.bankStatementLine.filter(
          (r) => r.matchedMovementId === row.id,
        ),
      };
    if (key === "treasuryObligation")
      return {
        model: "treasuryObligation",
        rows: state.treasuryObligation.filter(
          (r) =>
            (model === "lightweightSale" ? r.saleId : r.purchaseDocumentId) ===
            row.id,
        ),
      };
    if (key === "treasuryMovement")
      return {
        model: "treasuryMovement",
        rows: state.treasuryMovement.filter(
          (r) =>
            (model === "lightweightPayment"
              ? r.salePaymentId
              : r.purchasePaymentId) === row.id,
        ),
      };
    if (key === "payments")
      return {
        model:
          model === "lightweightSale"
            ? "lightweightPayment"
            : "purchasePayment",
        rows: state[
          model === "lightweightSale" ? "lightweightPayment" : "purchasePayment"
        ].filter(
          (r) =>
            (model === "lightweightSale" ? r.saleId : r.purchaseDocumentId) ===
            row.id,
        ),
        many: true,
      };
    if (key === "sessions")
      return {
        model: "cashSession",
        rows: state.cashSession.filter((r) => r.cashAccountId === row.id),
        many: true,
      };
    return null;
  };
  function matches(model: string, row: R, where: R = {}): boolean {
    return Object.entries(where).every(([key, wanted]) => {
      if (key === "OR")
        return (wanted as R[]).some((w) => matches(model, row, w));
      if (key === "AND")
        return (Array.isArray(wanted) ? wanted : [wanted]).every((w) =>
          matches(model, row, w as R),
        );
      if (key === "NOT")
        return !(Array.isArray(wanted) ? wanted : [wanted]).some((w) =>
          matches(model, row, w as R),
        );
      const relation = rel(model, row, key);
      if (relation && wanted && typeof wanted === "object") {
        const query = wanted as R;
        if (Object.hasOwn(query, "some")) return relation.rows.some((r) => matches(relation.model, r, query.some as R));
        if (Object.hasOwn(query, "is"))
          return query.is === null
            ? !relation.rows.length
            : relation.rows.some((r) =>
                matches(relation.model, r, query.is as R),
              );
        if (Object.hasOwn(query, "isNot"))
          return query.isNot === null
            ? !!relation.rows.length
            : !relation.rows.some((r) =>
                matches(relation.model, r, query.isNot as R),
              );
        return relation.rows.some((r) => matches(relation.model, r, query));
      }
      if (
        !(key in row) &&
        key.includes("_") &&
        wanted &&
        typeof wanted === "object"
      )
        return matches(model, row, wanted as R);
      const actual = row[key] ?? null;
      if (
        wanted &&
        typeof wanted === "object" &&
        !(wanted instanceof Prisma.Decimal) &&
        !(wanted instanceof Date)
      ) {
        const filter = wanted as R;
        return Object.entries(filter).every(([operator, operand]) =>
          operator === "in"
            ? (operand as unknown[]).some((v) => compare(actual, v) === 0)
            : operator === "notIn"
              ? !(operand as unknown[]).some((v) => compare(actual, v) === 0)
              : operator === "not"
                ? compare(actual, operand) !== 0
                : operator === "gt"
                  ? compare(actual, operand) > 0
                  : operator === "gte"
                    ? compare(actual, operand) >= 0
                    : operator === "lt"
                      ? compare(actual, operand) < 0
                      : operator === "lte"
                        ? compare(actual, operand) <= 0
                        : operator === "contains"
                          ? String(actual)
                              .toLowerCase()
                              .includes(String(operand).toLowerCase())
                          : operator === "mode"
                            ? true
                            : false,
        );
      }
      return compare(actual, wanted ?? null) === 0;
    });
  }
  function rows(model: string, args: R = {}) {
    const result = state[model].filter((r) =>
      matches(model, r, args.where as R),
    );
    const order = Array.isArray(args.orderBy)
      ? (args.orderBy as R[])
      : args.orderBy
        ? [args.orderBy as R]
        : [];
    result.sort((a, b) => {
      for (const item of order)
        for (const [key, direction] of Object.entries(item)) {
          const cmp = compare(a[key], b[key]);
          if (cmp) return direction === "desc" ? -cmp : cmp;
        }
      return 0;
    });
    const distinct = args.distinct as string[] | undefined;
    const seen = new Set<string>();
    const unique = distinct ? result.filter((row) => {
      const key = JSON.stringify(distinct.map((field) => row[field]));
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }) : result;
    return unique.slice(
      Number(args.skip ?? 0),
      args.take === undefined
        ? undefined
        : Number(args.skip ?? 0) + Number(args.take),
    );
  }
  function hydrate(
    model: string,
    row: R | undefined,
    args: R = {},
    depth = 0,
  ): R | null {
    if (!row) return null;
    const result = copy(row);
    if (depth > 4) return result;
    for (const [key, nested] of Object.entries((args.include as R) ?? {})) {
      const relation = rel(model, row, key);
      if (!relation) continue;
      const options = nested === true ? {} : (nested as R);
      const found = relation.rows.filter((r) =>
        matches(relation.model, r, options.where as R),
      );
      result[key] = relation.many
        ? found
            .slice(0, Number(options.take ?? found.length))
            .map((r) => hydrate(relation.model, r, options, depth + 1))
        : hydrate(relation.model, found[0], options, depth + 1);
    }
    return result;
  }
  function defaults(model: string, data: R): R {
    const common: R = {
      id: `${model}-${++sequence}`,
      tenantId: "tenant-a",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (model === "treasuryAccount")
      Object.assign(common, {
        name: "Account",
        type: "BANK",
        active: true,
        defaultAccount: false,
        currency: "USD",
        openingBalance: D(0),
        openingDate: new Date("2020-01-01"),
        feePercentage: D(0),
        fixedFee: D(0),
        settlementDays: 2,
      });
    if (model === "treasuryMovement")
      Object.assign(common, {
        status: "CONFIRMED",
        date: new Date(),
        amount: D(0),
        reversalOfId: null,
        obligationId: null,
        salePaymentId: null,
        purchasePaymentId: null,
      });
    if (model === "cashSession")
      Object.assign(common, {
        status: "OPEN",
        openedAt: new Date(),
        closedAt: null,
      });
    if (model === "treasuryAdvance")
      Object.assign(common, {
        status: "AVAILABLE",
        appliedAmount: D(0),
        customerId: null,
        supplierId: null,
      });
    if (model === "treasuryObligation")
      Object.assign(common, {
        status: "OPEN",
        paidAmount: D(0),
        saleId: null,
        purchaseDocumentId: null,
        customerId: null,
        supplierId: null,
        externalReference: `initial-${sequence}`,
      });
    if (model === "cardTransaction")
      Object.assign(common, { status: "PENDING", settledAt: null });
    if (model === "postdatedCheck")
      Object.assign(common, {
        status: "PENDING",
        customerId: null,
        supplierId: null,
        obligationId: null,
      });
    if (model === "bankReconciliation")
      Object.assign(common, { status: "DRAFT", dateToleranceDays: 2 });
    if (model === "bankStatementLine")
      Object.assign(common, { status: "UNMATCHED", matchedMovementId: null });
    return { ...common, ...copy(data) };
  }
  function assertUnique(model: string, data: R, exclude?: string) {
    const keys: Record<string, string[][]> = {
      treasuryMovement: [
        ["tenantId", "sourceType", "sourceId", "movementType", "direction"],
        ["salePaymentId"],
        ["purchasePaymentId"],
        ["reversalOfId"],
      ],
      treasuryObligation: [
        ["tenantId", "type", "externalReference"],
        ["saleId"],
        ["purchaseDocumentId"],
      ],
      cardTransaction: [["tenantId", "sourceId"]],
      advanceApplication: [["tenantId", "requestKey"]],
      bankStatementLine: [
        ["matchedMovementId"],
        ["tenantId", "bankAccountId", "importKey"],
      ],
    };
    for (const key of keys[model] ?? [])
      if (
        key.every((k) => data[k] !== undefined && data[k] !== null) &&
        state[model].some(
          (r) =>
            r.id !== exclude && key.every((k) => compare(r[k], data[k]) === 0),
        )
      )
        throw new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "test",
        });
    if (
      model === "cashSession" &&
      data.status === "OPEN" &&
      state[model].some(
        (r) =>
          r.id !== exclude &&
          r.tenantId === data.tenantId &&
          r.cashAccountId === data.cashAccountId &&
          r.status === "OPEN",
      )
    )
      throw new Error("OPEN_SESSION_UNIQUE");
  }
  function update(model: string, row: R, data: R) {
    const result = { ...row };
    for (const [key, next] of Object.entries(data)) {
      if (
        next &&
        typeof next === "object" &&
        !(next instanceof Prisma.Decimal) &&
        !(next instanceof Date) &&
        ("increment" in next || "decrement" in next)
      ) {
        const delta = next as R;
        result[key] = D(String(row[key] ?? 0)).plus(
          String(delta.increment ?? D(String(delta.decrement)).negated()),
        );
      } else result[key] = copy(next);
    }
    assertUnique(model, result, String(row.id));
    Object.assign(row, result);
    return copy(row);
  }
  const client: Record<string, unknown> = {};
  for (const model of tables)
    client[model] = {
      findMany: async (args: R = {}) =>
        rows(model, args).map((r) => hydrate(model, r, args)),
      findFirst: async (args: R = {}) =>
        hydrate(model, rows(model, args)[0], args),
      findFirstOrThrow: async (args: R = {}) => {
        const found = hydrate(model, rows(model, args)[0], args);
        if (!found) throw new Error("NOT_FOUND");
        return found;
      },
      findUnique: async (args: R) => hydrate(model, rows(model, args)[0], args),
      count: async (args: R = {}) => rows(model, args).length,
      create: async (args: R) => {
        const count = failures.get(model);
        if (count !== undefined) {
          if (count === 0) throw new Error("INJECTED_FAILURE");
          failures.set(model, count - 1);
        }
        const row = defaults(model, args.data as R);
        assertUnique(model, row);
        state[model].push(row);
        return hydrate(model, row, args);
      },
      createMany: async (args: R) => {
        let count = 0;
        for (const input of args.data as R[]) {
          const remaining = failures.get(model);
          if (remaining !== undefined) {
            if (remaining === 0) throw new Error("INJECTED_FAILURE");
            failures.set(model, remaining - 1);
          }
          const row = defaults(model, input);
          try {
            assertUnique(model, row);
            state[model].push(row);
            count++;
          } catch (error) {
            if (!args.skipDuplicates) throw error;
          }
        }
        return { count };
      },
      update: async (args: R) => {
        const row = rows(model, { where: args.where })[0];
        if (!row) throw new Error("NOT_FOUND");
        update(model, row, args.data as R);
        return hydrate(model, row, args);
      },
      updateMany: async (args: R) => {
        const found = rows(model, { where: args.where });
        for (const row of found) update(model, row, args.data as R);
        return { count: found.length };
      },
      upsert: async (args: R) => {
        const row = rows(model, { where: args.where })[0];
        if (row) return update(model, row, args.update as R);
        const created = defaults(model, args.create as R);
        assertUnique(model, created);
        state[model].push(created);
        return copy(created);
      },
      aggregate: async (args: R) => ({
        _sum: Object.fromEntries(
          Object.keys(args._sum as R).map((key) => [
            key,
            rows(model, args).reduce(
              (sum, row) => sum.plus(String(row[key] ?? 0)),
              D(0),
            ),
          ]),
        ),
      }),
      groupBy: async (args: R) => {
        const groups = new Map<string, R[]>();
        const by = args.by as string[];
        for (const row of rows(model, args)) {
          const key = by.map((k) => row[k]).join("|");
          groups.set(key, [...(groups.get(key) ?? []), row]);
        }
        return [...groups.values()].map((group) => ({
          ...Object.fromEntries(by.map((key) => [key, group[0][key]])),
          _sum: Object.fromEntries(
            Object.keys(args._sum as R).map((key) => [
              key,
              group.reduce((sum, row) => sum.plus(String(row[key] ?? 0)), D(0)),
            ]),
          ),
        }));
      },
    };
  client.$queryRaw = async (
    query: Prisma.Sql | TemplateStringsArray,
    ...params: unknown[]
  ) => {
    const sql = Array.isArray(query)
        ? query.join("?")
        : (query as Prisma.Sql).sql,
      values = Array.isArray(query) ? params : (query as Prisma.Sql).values;
    const table = sql.match(/FROM "([a-zA-Z]+)"/)?.[1];
    if (!table) throw new Error("Invalid test SQL");
    const model = table[0].toLowerCase() + table.slice(1);
    return state[model]
      .filter((r) => values.includes(r.id) && values.includes(r.tenantId))
      .map((r) => ({ id: r.id }));
  };
  client.$transaction = async (
    operation: (tx: unknown) => Promise<unknown>,
  ) => {
    const previous = queue;
    let unlock!: () => void;
    queue = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previous;
    const before = copy(state);
    txCount++;
    try {
      return await operation({ ...client, $transaction: undefined });
    } catch (error) {
      state = before;
      throw error;
    } finally {
      unlock();
    }
  };
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const old = globalDb.prisma,
    oldUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://unused:unused@localhost:1/unused";
  globalDb.prisma = client as unknown as PrismaClient;
  t.after(() => {
    globalDb.prisma = old;
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
  });
  return {
    db: client as unknown as PrismaClient,
    rows: (model: string) => copy(state[model]),
    seed: (model: string, data: R) => {
      const row = defaults(model, data);
      state[model].push(row);
      return copy(row);
    },
    failAfter: (model: string, creations: number) =>
      failures.set(model, creations),
    transactions: () => txCount,
  };
}
