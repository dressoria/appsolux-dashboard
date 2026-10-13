import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { treasuryStore } from "./test-store";
import {
  amount,
  cardAmounts,
  date,
  dec,
  money,
  obligationState,
} from "./domain";
import { accountBalance, financialTransaction, type Actor } from "./db";
import {
  cashSession,
  manualMovement,
  saveAccount,
  transfer,
  reverseManualMovement,
} from "./accounts";
import {
  collectOrPay,
  createObligation,
  createAdvance,
  applyAdvance,
} from "./obligations";
import { createCheck, transitionCheck } from "./checks";
import { createCardCollection, settleCard } from "./cards";
import {
  parseCsv,
  previewObligations,
  confirmObligations,
  previewStatement,
  readImportFile,
} from "./imports";
import {
  createReconciliation,
  importStatement,
  confirmMatch,
  completeReconciliation,
  matchCandidates,
} from "./reconciliation";
import {
  integrateSale,
  integratePurchase,
  allocatePayment,
} from "./integration";
import { treasuryApi } from "./api";
import { listAccounts } from "./reads";
import { TREASURY_NAVIGATION } from "../../../config/treasury-navigation";
import { buildSidebarNavigation } from "../../../components/appsolux/layout/sidebar";
import type { TenantModeState } from "../tenant-mode";

const actor: Actor = { tenantId: "tenant-a", userId: "user-a" };
const D = dec;
const strings = (row: Record<string, unknown>, key: string) => String(row[key]);
function setup(store: ReturnType<typeof treasuryStore>) {
  store.seed("treasuryAccount", {
    id: "cash-a",
    tenantId: "tenant-a",
    type: "CASH",
    openingBalance: D(100),
    defaultAccount: true,
  });
  store.seed("treasuryAccount", {
    id: "bank-a",
    tenantId: "tenant-a",
    type: "BANK",
    openingBalance: D(500),
    defaultAccount: true,
  });
  store.seed("treasuryAccount", {
    id: "bank-b",
    tenantId: "tenant-a",
    type: "BANK",
    openingBalance: D(0),
  });
  store.seed("treasuryAccount", {
    id: "foreign-bank",
    tenantId: "tenant-b",
    type: "BANK",
    openingBalance: D(999),
  });
  store.seed("treasuryAccount", {
    id: "card-a",
    tenantId: "tenant-a",
    type: "CARD",
    openingBalance: D(0),
    feePercentage: D("2.5"),
    fixedFee: D("0.30"),
    settlementBankAccountId: "bank-a",
    defaultAccount: true,
  });
  store.seed("lightweightCustomer", {
    id: "customer-a",
    tenantId: "tenant-a",
    name: "Customer A",
    identification: "1790012345001",
    isActive: true,
    balance: D(100),
  });
  store.seed("lightweightSupplier", {
    id: "supplier-a",
    tenantId: "tenant-a",
    name: "Supplier A",
    identification: "1790012345002",
    isActive: true,
  });
}
function debt(
  store: ReturnType<typeof treasuryStore>,
  type: "RECEIVABLE" | "PAYABLE" = "RECEIVABLE",
  overrides: Record<string, unknown> = {},
) {
  return store.seed("treasuryObligation", {
    id: "debt-a",
    tenantId: "tenant-a",
    type,
    originalAmount: D(100),
    paidAmount: D(0),
    balance: D(100),
    dueDate: new Date(Date.now() + 86400000),
    issueDate: new Date(),
    customerId: type === "RECEIVABLE" ? "customer-a" : null,
    supplierId: type === "PAYABLE" ? "supplier-a" : null,
    ...overrides,
  });
}

test("navigation has five exact submenus and no standalone Cobros/Pagos; legacy URLs redirect", () => {
  const group = buildSidebarNavigation({} as TenantModeState).find(
    (g) => g.key === "treasury",
  );
  assert.ok(group);
  assert.deepEqual(
    group.items.map((i) => i.title),
    ["Caja", "Bancos", "Cartera", "Anticipos", "Tarjetas"],
  );
  assert.equal(TREASURY_NAVIGATION.flatMap((g) => [...g.items]).length, 13);
  for (const route of [
    "app/facturacion/cash/page.tsx",
    ...["collections", "payments", "receivables", "payables"].map(
      (p) => `app/facturacion/treasury/${p}/page.tsx`,
    ),
  ]) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /redirect\(/);
    assert.doesNotMatch(source, /@\/app\/erp/);
  }
});
test("A/K: account lists and operations exclude tenant B", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const result = await listAccounts("tenant-a", "BANK", new URLSearchParams());
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((a) => a.tenantId === "tenant-a"));
  await assert.rejects(
    () =>
      manualMovement(actor, "BANK", {
        accountId: "foreign-bank",
        direction: "IN",
        amount: "10",
        description: "Bad",
        requestKey: "bad",
      }),
    /no disponible/,
  );
});
test("B/C: opening records server balance and rejects a second open session", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const session = await cashSession(actor, {
    action: "open",
    accountId: "cash-a",
    openingAmount: "999999",
  });
  assert.equal(session.openingAmount.toFixed(2), "100.00");
  await assert.rejects(
    () => cashSession(actor, { action: "open", accountId: "cash-a" }),
    /ya tiene/,
  );
  assert.equal(store.rows("cashSession").length, 1);
});
test("D/E/F/G: cash IN/OUT and closing difference are calculated server-side", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  await cashSession(actor, { action: "open", accountId: "cash-a" });
  const incoming = await manualMovement(actor, "CASH", {
    accountId: "cash-a",
    direction: "IN",
    amount: "20.10",
    description: "In",
    requestKey: "in",
  });
  assert.equal(incoming.direction, "IN");
  const outgoing = await manualMovement(actor, "CASH", {
    accountId: "cash-a",
    direction: "OUT",
    amount: "10.05",
    description: "Out",
    requestKey: "out",
  });
  assert.equal(outgoing.direction, "OUT");
  const closed = await cashSession(actor, {
    action: "close",
    accountId: "cash-a",
    countedAmount: "109.00",
    expectedClosingAmount: "1",
    differenceAmount: "0",
  });
  assert.equal(closed.expectedClosingAmount?.toFixed(2), "110.05");
  assert.equal(closed.differenceAmount?.toFixed(2), "-1.05");
  assert.equal(store.rows("cashClosing").length, 1);
  await assert.rejects(
    () =>
      manualMovement(actor, "CASH", {
        accountId: "cash-a",
        direction: "IN",
        amount: "1",
        description: "Closed",
        requestKey: "closed",
      }),
    /sesión abierta/,
  );
});
test("manual movements reject zero/negative amounts and insufficient funds", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  for (const value of ["0", "-1", "NaN", "1e3", "1.001"])
    await assert.rejects(() =>
      manualMovement(actor, "BANK", {
        accountId: "bank-a",
        direction: "IN",
        amount: value,
        description: "Invalid",
        requestKey: "bad",
      }),
    );
  await assert.rejects(
    () =>
      manualMovement(actor, "BANK", {
        accountId: "bank-a",
        direction: "OUT",
        amount: "501",
        description: "Invalid",
        requestKey: "bad",
      }),
    /insuficiente/,
  );
  assert.equal(store.rows("treasuryMovement").length, 0);
});
test("confirmed manual movement corrections create an audited compensator, not an edit", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const movement = await manualMovement(actor, "BANK", {
    accountId: "bank-a",
    direction: "IN",
    amount: "20",
    description: "Entry",
    requestKey: "entry",
  });
  await reverseManualMovement(actor, {
    id: movement.id,
    reason: "Duplicate manual entry",
  });
  assert.equal(store.rows("treasuryMovement").length, 2);
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "bank-a")).toFixed(2),
    "500.00",
  );
  assert.equal(store.rows("treasuryMovement")[0].status, "CONFIRMED");
  assert.ok(store.rows("treasuryMovement")[0].cancelledAt);
  assert.ok(store.rows("auditLog").length >= 3);
});
test("H/I/J: pending cheque is not cash; clearing makes one bank movement and rejects foreign check", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const check = await createCheck(actor, {
    direction: "RECEIVABLE",
    checkNumber: "123",
    bankName: "Bank",
    issuerName: "Issuer",
    amount: "30",
    issueDate: "2025-10-01",
    dueDate: "2025-10-02",
  });
  assert.equal(store.rows("treasuryMovement").length, 0);
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "cash-a")).toFixed(2),
    "100.00",
  );
  await transitionCheck(actor, check.id, { status: "DEPOSITED" });
  assert.equal(store.rows("treasuryMovement").length, 0);
  await transitionCheck(actor, check.id, {
    status: "CLEARED",
    accountId: "bank-a",
  });
  await transitionCheck(actor, check.id, {
    status: "CLEARED",
    accountId: "bank-a",
  });
  assert.equal(store.rows("treasuryMovement").length, 1);
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "bank-a")).toFixed(2),
    "530.00",
  );
  store.seed("postdatedCheck", { id: "foreign-check", tenantId: "tenant-b" });
  await assert.rejects(
    () => transitionCheck(actor, "foreign-check", { status: "CANCELLED" }),
    /no encontrado/,
  );
});
test("payable cheque does not pay until clearing; bounced clearing restores obligation and money", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  debt(store, "PAYABLE");
  const check = await createCheck(actor, {
    direction: "PAYABLE",
    obligationId: "debt-a",
    checkNumber: "456",
    bankName: "Bank",
    issuerName: "Us",
    amount: "40",
    issueDate: "2025-10-01",
    dueDate: "2025-10-02",
  });
  await transitionCheck(actor, check.id, { status: "DELIVERED" });
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "100");
  await transitionCheck(actor, check.id, {
    status: "CLEARED",
    accountId: "bank-a",
  });
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "60");
  await transitionCheck(actor, check.id, {
    status: "BOUNCED",
    reason: "Bank returned it",
  });
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "100");
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "bank-a")).toFixed(2),
    "500.00",
  );
});
test("L: transfer creates a paired OUT/IN group and repeated request is idempotent", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const rows = await transfer(actor, {
    fromAccountId: "bank-a",
    toAccountId: "bank-b",
    amount: "75.25",
    requestKey: "transfer-a",
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].direction, "OUT");
  assert.equal(rows[1].direction, "IN");
  assert.equal(rows[0].transferGroupId, rows[1].transferGroupId);
  await transfer(actor, {
    fromAccountId: "bank-a",
    toAccountId: "bank-b",
    amount: "75.25",
    requestKey: "transfer-a",
  });
  assert.equal(store.rows("treasuryMovement").length, 2);
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "bank-a")).toFixed(2),
    "424.75",
  );
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "bank-b")).toFixed(2),
    "75.25",
  );
});
test("M: failure on the incoming half rolls back the outgoing half and its audit", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  store.failAfter("treasuryMovement", 1);
  await assert.rejects(
    () =>
      transfer(actor, {
        fromAccountId: "bank-a",
        toAccountId: "bank-b",
        amount: "75",
        requestKey: "failed",
      }),
    /INJECTED_FAILURE/,
  );
  assert.equal(store.rows("treasuryMovement").length, 0);
  assert.equal(store.rows("auditLog").length, 0);
});
test("N: statement matching is tenant scoped and prevents double reconciliation", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  store.seed("bankReconciliation", {
    id: "recon-a",
    bankAccountId: "bank-a",
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2099-01-01"),
  });
  store.seed("bankStatementLine", {
    id: "line-a",
    bankAccountId: "bank-a",
    reconciliationId: "recon-a",
    amount: D(20),
    direction: "IN",
    date: new Date(),
    reference: "REF",
  });
  store.seed("bankStatementLine", {
    id: "line-b",
    bankAccountId: "bank-a",
    reconciliationId: "recon-a",
    amount: D(20),
    direction: "IN",
    date: new Date(),
    reference: "REF",
  });
  const movement = await manualMovement(actor, "BANK", {
    accountId: "bank-a",
    direction: "IN",
    amount: "20",
    description: "Deposit",
    reference: "REF",
    requestKey: "deposit",
  });
  await confirmMatch(actor, { lineId: "line-a", movementId: movement.id });
  assert.equal(store.rows("treasuryMovement")[0].status, "RECONCILED");
  await assert.rejects(
    () => confirmMatch(actor, { lineId: "line-b", movementId: movement.id }),
    /ya fue conciliado/,
  );
});
test("deterministic matching distinguishes exact, ambiguous, possible and wrong amounts", () => {
  const line = {
    amount: D(10),
    direction: "IN",
    date: new Date("2025-01-02T17:00:00Z"),
    reference: "REF",
  };
  const movement = {
    id: "m",
    amount: D(10),
    direction: "IN",
    date: new Date("2025-01-02T06:00:00Z"),
    reference: "REF",
  };
  assert.equal(matchCandidates(line, [movement], 2)[0].match, "EXACT");
  assert.ok(
    matchCandidates(line, [movement, { ...movement, id: "other" }], 2).every(
      (c) => c.match === "POSSIBLE",
    ),
  );
  assert.equal(
    matchCandidates(
      line,
      [{ ...movement, date: new Date("2025-01-03T06:00:00Z") }],
      2,
    )[0].match,
    "POSSIBLE",
  );
  assert.equal(
    matchCandidates(line, [{ ...movement, amount: D(11) }], 2).length,
    0,
  );
});
test("O: statement preview is pure and validates dates, directions and values", () => {
  const preview = previewStatement(
    [
      {
        fecha: "2025-10-01",
        descripcion: "Deposit",
        referencia: "REF",
        monto: "10.20",
        direccion: "IN",
      },
    ],
    date("2025-10-01"),
    date("2025-11-01"),
  );
  assert.equal(preview.valid, true);
  assert.equal(preview.lines[0].amount.toFixed(2), "10.20");
  assert.equal(
    previewStatement(
      [
        {
          fecha: "2025-09-01",
          descripcion: "Bad",
          monto: "10",
          direccion: "IN",
        },
      ],
      date("2025-10-01"),
      date("2025-11-01"),
    ).valid,
    false,
  );
});
test("P/Q/R/S/T: receivable partial and total collections create IN and reject overpayment", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  debt(store);
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "100");
  await collectOrPay(actor, "debt-a", "RECEIVABLE", {
    accountId: "bank-a",
    method: "transfer",
    amount: "40",
    requestKey: "collect-a",
    balance: "999",
    paidAmount: "999",
  });
  assert.equal(store.rows("treasuryObligation")[0].status, "PARTIAL");
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "60");
  assert.equal(store.rows("treasuryMovement")[0].direction, "IN");
  await assert.rejects(
    () =>
      collectOrPay(actor, "debt-a", "RECEIVABLE", {
        accountId: "bank-a",
        method: "transfer",
        amount: "61",
        requestKey: "over",
      }),
    /supera/,
  );
  await collectOrPay(actor, "debt-a", "RECEIVABLE", {
    accountId: "bank-a",
    method: "transfer",
    amount: "60",
    requestKey: "collect-b",
  });
  assert.equal(store.rows("treasuryObligation")[0].status, "PAID");
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "0");
});
test("U/V/W/X: payable partial and full payments create OUT; failed payment is atomic", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  debt(store, "PAYABLE");
  await collectOrPay(actor, "debt-a", "PAYABLE", {
    accountId: "bank-a",
    method: "transfer",
    amount: "25",
    requestKey: "pay-a",
  });
  assert.equal(store.rows("treasuryObligation")[0].status, "PARTIAL");
  assert.equal(store.rows("treasuryMovement")[0].direction, "OUT");
  await assert.rejects(
    () =>
      collectOrPay(actor, "debt-a", "PAYABLE", {
        accountId: "bank-a",
        method: "transfer",
        amount: "76",
        requestKey: "over",
      }),
    /supera/,
  );
  await collectOrPay(actor, "debt-a", "PAYABLE", {
    accountId: "bank-a",
    method: "transfer",
    amount: "75",
    requestKey: "pay-b",
  });
  assert.equal(store.rows("treasuryObligation")[0].status, "PAID");
});
test("purchase collection reuses one PurchasePayment linked to its TreasuryMovement", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  store.seed("purchaseDocument", {
    id: "purchase-a",
    tenantId: "tenant-a",
    status: "REGISTERED",
    total: D(100),
  });
  debt(store, "PAYABLE", { purchaseDocumentId: "purchase-a" });
  await collectOrPay(actor, "debt-a", "PAYABLE", {
    accountId: "bank-a",
    method: "transfer",
    amount: "10",
    requestKey: "pay-linked",
  });
  assert.equal(store.rows("purchasePayment").length, 1);
  assert.equal(
    store.rows("treasuryMovement")[0].purchasePaymentId,
    store.rows("purchasePayment")[0].id,
  );
});
test("Y/Z/AA: obligation preview does not persist; confirmation is idempotent and rejects tenant B party", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const rows = [
    {
      tipo: "RECEIVABLE",
      identificacion: "1790012345001",
      nombre: "Customer A",
      numero_documento: "DOC-01",
      fecha_emision: "2025-10-01",
      fecha_vencimiento: "2025-10-31",
      valor_original: "100.00",
      saldo_pendiente: "80.00",
      observacion: "Opening",
    },
  ];
  assert.equal((await previewObligations("tenant-a", rows)).valid, true);
  assert.equal(store.rows("treasuryObligation").length, 0);
  assert.equal(store.rows("treasuryMovement").length, 0);
  assert.equal((await confirmObligations(actor, rows)).imported, 1);
  assert.equal((await confirmObligations(actor, rows)).imported, 0);
  assert.equal(store.rows("treasuryObligation").length, 1);
  assert.equal(store.rows("lightweightSale").length, 0);
  assert.equal(store.rows("purchaseDocument").length, 0);
  assert.equal(store.rows("treasuryMovement").length, 0);
  store.seed("lightweightCustomer", {
    id: "foreign-customer",
    tenantId: "tenant-b",
    identification: "foreign",
    isActive: true,
  });
  assert.equal(
    (
      await previewObligations("tenant-a", [
        { ...rows[0], identificacion: "foreign" },
      ])
    ).valid,
    false,
  );
});
test("CSV parser handles quoted commas, newlines, escaped quotes and semicolons", () => {
  assert.deepEqual(
    parseCsv('a,b\n"hello, world","line\nnext"\n"say ""yes""",x'),
    [
      ["a", "b"],
      ["hello, world", "line\nnext"],
      ['say "yes"', "x"],
    ],
  );
  assert.deepEqual(parseCsv("a;b\r\nx;y"), [
    ["a", "b"],
    ["x", "y"],
  ]);
});
test("CSV and XLSX files produce identical preview rows, without persistence", async () => {
  const csv = new File(
    ["fecha,descripcion,monto,direccion\n2025-10-01,Deposit,10.20,IN\n"],
    "statement.csv",
  );
  const ExcelJS = (await import("exceljs")).default,
    workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("Statement");
  sheet.addRow(["fecha", "descripcion", "monto", "direccion"]);
  sheet.addRow(["2025-10-01", "Deposit", "10.20", "IN"]);
  const xlsx = new File([await workbook.xlsx.writeBuffer()], "statement.xlsx");
  assert.deepEqual(await readImportFile(csv), await readImportFile(xlsx));
});
test("AB/AC: customer advance creates IN, supplier advance creates OUT; neither creates a sale", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  await createAdvance(actor, "CUSTOMER", {
    partyId: "customer-a",
    accountId: "bank-a",
    method: "transfer",
    amount: "30",
    requestKey: "advance-a",
  });
  await createAdvance(actor, "SUPPLIER", {
    partyId: "supplier-a",
    accountId: "bank-a",
    method: "transfer",
    amount: "20",
    requestKey: "advance-b",
  });
  assert.deepEqual(
    store.rows("treasuryMovement").map((m) => m.direction),
    ["IN", "OUT"],
  );
  assert.equal(store.rows("lightweightSale").length, 0);
  assert.equal(store.rows("treasuryAdvance").length, 2);
});
test("AD/AE: advance application reduces both balances without new money and rejects excess", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  debt(store);
  const advance = await createAdvance(actor, "CUSTOMER", {
    partyId: "customer-a",
    accountId: "bank-a",
    method: "transfer",
    amount: "50",
    requestKey: "advance",
  });
  await applyAdvance(actor, String(advance.id), {
    obligationId: "debt-a",
    amount: "20",
    requestKey: "apply",
  });
  assert.equal(store.rows("treasuryMovement").length, 1);
  assert.equal(strings(store.rows("treasuryAdvance")[0], "balance"), "30");
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "80");
  await applyAdvance(actor, String(advance.id), {
    obligationId: "debt-a",
    amount: "20",
    requestKey: "apply",
  });
  assert.equal(store.rows("advanceApplication").length, 1);
  await assert.rejects(
    () =>
      applyAdvance(actor, String(advance.id), {
        obligationId: "debt-a",
        amount: "31",
        requestKey: "excess",
      }),
    /supera/,
  );
});
test("AF/AG/AH/AI/AJ: card remains pending until net settlement and repeat settlement is idempotent", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const card = await createCardCollection(actor, {
    accountId: "card-a",
    amount: "100",
    requestKey: "card",
  });
  assert.equal(card.status, "PENDING");
  assert.equal(card.feeAmount.toFixed(2), "2.80");
  assert.equal(card.netAmount.toFixed(2), "97.20");
  assert.ok(
    store.rows("treasuryMovement").every((m) => m.accountId === "card-a"),
  );
  await settleCard(actor, card.id, { bankAccountId: "bank-a" });
  await settleCard(actor, card.id, { bankAccountId: "bank-a" });
  assert.equal(
    store.rows("treasuryMovement").filter((m) => m.accountId === "bank-a")
      .length,
    1,
  );
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "bank-a")).toFixed(2),
    "597.20",
  );
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "card-a")).toFixed(2),
    "0.00",
  );
});
test("card fees use decimal half-up rounding and cannot exceed the gross", () => {
  assert.equal(cardAmounts("0.20", "2.5", "0").fee.toFixed(2), "0.01");
  assert.throws(() => cardAmounts("1", "5", "2"), /supera/);
});
test("AK/AL: API ignores frontend tenant, checks suspended guard before mutation and requires session", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const get = await treasuryApi(
    new NextRequest("http://localhost/api/treasury/banks?tenantId=tenant-b"),
    "banks",
    { authorize: async () => actor },
  );
  assert.equal(get.status, 200);
  assert.ok(
    (await get.json()).items.every(
      (r: { tenantId: string }) => r.tenantId === "tenant-a",
    ),
  );
  assert.match(get.headers.get("cache-control")!, /no-store/);
  const denied = await treasuryApi(
    new NextRequest("http://localhost/api/treasury/cash/movements", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant-b",
        accountId: "cash-a",
        amount: "1",
      }),
    }),
    "cash/movements",
    {
      authorize: async () => actor,
      operate: async (tenantId) => {
        assert.equal(tenantId, "tenant-a");
        throw Object.assign(new Error("Suspended"), {
          code: "TENANT_OPERATION_SUSPENDED",
        });
      },
    },
  );
  assert.equal(denied.status, 403);
  assert.equal(store.rows("treasuryMovement").length, 0);
  assert.equal(
    (
      await treasuryApi(
        new NextRequest("http://localhost/api/treasury/summary"),
        "summary",
        { authorize: async () => null },
      )
    ).status,
    401,
  );
});
test("AM: automatic sale capture is idempotent and credit sales create debt without cash", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  store.seed("lightweightSale", {
    id: "sale-a",
    tenantId: "tenant-a",
    origin: "NORMAL",
    status: "paid",
    total: D(100),
    customerId: "customer-a",
  });
  store.seed("lightweightPayment", {
    id: "payment-a",
    saleId: "sale-a",
    method: "transfer",
    amount: D(100),
  });
  const context = { actor, activatedAt: new Date("2020-01-01") };
  await financialTransaction((tx) =>
    integrateSale(tx, context, "sale-a", ["payment-a"]),
  );
  await financialTransaction((tx) =>
    integrateSale(tx, context, "sale-a", ["payment-a"]),
  );
  assert.equal(store.rows("treasuryMovement").length, 1);
  store.seed("lightweightSale", {
    id: "credit-sale",
    tenantId: "tenant-a",
    origin: "NORMAL",
    status: "open",
    total: D(50),
    customerId: "customer-a",
  });
  store.seed("lightweightPayment", {
    id: "credit-payment",
    saleId: "credit-sale",
    method: "credit",
    amount: D(0),
  });
  await financialTransaction((tx) =>
    integrateSale(tx, context, "credit-sale", ["credit-payment"]),
  );
  assert.equal(store.rows("treasuryMovement").length, 1);
  assert.equal(store.rows("treasuryObligation").length, 1);
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "50");
});
test("new purchase integration creates one payable and reuses its existing payment", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  store.seed("purchaseDocument", {
    id: "purchase-a",
    tenantId: "tenant-a",
    origin: "MANUAL",
    status: "REGISTERED",
    documentType: "INVOICE",
    total: D(100),
    supplierId: "supplier-a",
    issueDate: new Date(),
    paymentTermDays: 30,
  });
  store.seed("purchasePayment", {
    id: "purchase-payment",
    purchaseDocumentId: "purchase-a",
    method: "transfer",
    amount: D(20),
    paidAt: new Date(),
  });
  await financialTransaction((tx) =>
    integratePurchase(
      tx,
      { actor, activatedAt: new Date("2020-01-01") },
      "purchase-a",
    ),
  );
  assert.equal(store.rows("treasuryObligation").length, 1);
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "80");
  assert.equal(store.rows("purchasePayment").length, 1);
  assert.equal(
    store.rows("treasuryMovement")[0].purchasePaymentId,
    "purchase-payment",
  );
});
test("old payments cannot be retroactively allocated as new treasury money", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  store.seed("lightweightSale", {
    id: "old-sale",
    tenantId: "tenant-a",
    status: "paid",
  });
  store.seed("lightweightPayment", {
    id: "old-pay",
    saleId: "old-sale",
    method: "transfer",
    amount: D(100),
    createdAt: new Date("2020-01-01"),
  });
  await assert.rejects(
    () =>
      financialTransaction((tx) =>
        allocatePayment(
          tx,
          { actor, activatedAt: new Date("2025-01-01"), accountId: "bank-a" },
          "SALE",
          "old-pay",
        ),
      ),
    /no disponible/,
  );
  assert.equal(store.rows("treasuryMovement").length, 0);
});
test("AN: money uses Decimal, date validation is strict and status is calculated from DB values", () => {
  assert.ok(amount("0.10") instanceof Prisma.Decimal);
  assert.equal(money(amount("0.10").plus(amount("0.20"))), "0.30");
  assert.equal(
    obligationState("100", "40", new Date("2099-01-01")).balance.toFixed(2),
    "60.00",
  );
  assert.throws(() => date("2025-02-30"));
  assert.throws(() => obligationState("100", "101", new Date()));
});
test("AO: failure after an obligation payment rolls back debt, payment and movement", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  debt(store);
  store.failAfter("treasuryMovement", 0);
  await assert.rejects(
    () =>
      collectOrPay(actor, "debt-a", "RECEIVABLE", {
        accountId: "bank-a",
        method: "transfer",
        amount: "10",
        requestKey: "fail",
      }),
    /INJECTED_FAILURE/,
  );
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "100");
  assert.equal(store.rows("treasuryMovement").length, 0);
  assert.ok(store.transactions() > 0);
});
test("serialized concurrent collection attempts cannot spend a receivable balance twice", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  debt(store);
  const results = await Promise.allSettled([
    collectOrPay(actor, "debt-a", "RECEIVABLE", {
      accountId: "bank-a",
      method: "transfer",
      amount: "60",
      requestKey: "one",
    }),
    collectOrPay(actor, "debt-a", "RECEIVABLE", {
      accountId: "bank-a",
      method: "transfer",
      amount: "60",
      requestKey: "two",
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(strings(store.rows("treasuryObligation")[0], "balance"), "40");
  assert.equal(store.rows("treasuryMovement").length, 1);
});

test("bank creation keeps only a masked number, enforces currency and does not allow opening balance edits", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const bank = await saveAccount(actor, "BANK", {
    name: "Savings",
    bankName: "Bank",
    accountName: "Company",
    accountNumber: "1234567890",
    openingBalance: "10.20",
    openingDate: "2025-01-01",
    requestKey: "bank",
  });
  assert.equal(bank.accountNumberMasked, "****7890");
  await assert.rejects(
    () =>
      saveAccount(actor, "BANK", {
        name: "Savings",
        bankName: "Bank",
        accountName: "Company",
        openingBalance: "10.20",
      }),
    /Ya existe/,
  );
  assert.equal(
    (bank as unknown as Record<string, unknown>).accountNumber,
    undefined,
  );
  const edited = await saveAccount(actor, "BANK", {
    id: bank.id,
    name: "New name",
    openingBalance: "99999",
  });
  assert.equal(edited.openingBalance.toFixed(2), "10.20");
  await assert.rejects(
    () => saveAccount(actor, "BANK", { id: bank.id, active: false }),
    /saldo/,
  );
  await assert.rejects(
    () =>
      saveAccount(actor, "BANK", {
        name: "Euro",
        bankName: "Bank",
        accountName: "Company",
        currency: "EUR",
        openingBalance: "0",
      }),
    /Opción/,
  );
});
test("manually creating an obligation calculates paid amount and rejects a foreign counterparty", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const obligation = await createObligation(actor, "RECEIVABLE", {
    partyId: "customer-a",
    originalAmount: "100",
    balance: "60",
    paidAmount: "0",
    issueDate: "2025-01-01",
    dueDate: "2025-02-01",
    requestKey: "opening",
  });
  assert.equal(obligation.paidAmount.toFixed(2), "40.00");
  assert.equal(store.rows("treasuryMovement").length, 0);
  await assert.rejects(
    () =>
      createObligation(actor, "RECEIVABLE", {
        partyId: "foreign",
        originalAmount: "100",
        balance: "100",
        issueDate: "2025-01-01",
        dueDate: "2025-02-01",
        requestKey: "foreign",
      }),
    /tercero/,
  );
});
test("reconciliation imports rows once, requires every match and closes with recomputed balances", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const reconciliation = await createReconciliation(actor, {
    accountId: "bank-a",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
    statementOpeningBalance: "500",
    statementClosingBalance: "520",
    systemClosingBalance: "999",
    dateToleranceDays: 2,
  });
  const movement = await manualMovement(actor, "BANK", {
    accountId: "bank-a",
    amount: "20",
    direction: "IN",
    description: "Deposit",
    date: "2025-01-10",
    reference: "REF",
    requestKey: "deposit",
  });
  const rows = [
    {
      fecha: "2025-01-10",
      descripcion: "Deposit",
      referencia: "REF",
      monto: "20",
      direccion: "IN",
    },
  ];
  assert.equal(
    (await importStatement(actor, reconciliation.id, rows)).imported,
    1,
  );
  assert.equal(
    (await importStatement(actor, reconciliation.id, rows)).imported,
    0,
  );
  await assert.rejects(
    () => completeReconciliation(actor, reconciliation.id),
    /sin conciliar/,
  );
  await confirmMatch(actor, {
    lineId: store.rows("bankStatementLine")[0].id,
    movementId: movement.id,
  });
  const closed = await completeReconciliation(actor, reconciliation.id);
  assert.equal(closed.status, "COMPLETED");
  assert.equal(closed.systemClosingBalance.toFixed(2), "520.00");
  assert.equal(closed.difference.toFixed(2), "0.00");
  await assert.rejects(
    () =>
      manualMovement(actor, "BANK", {
        accountId: "bank-a",
        amount: "1",
        direction: "IN",
        description: "Retroactive",
        date: "2025-01-11",
        requestKey: "retroactive",
      }),
    /cerrado/,
  );
});
test("a successful mutation uses the session tenant instead of frontend tenant and balances", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const response = await treasuryApi(
    new NextRequest("http://localhost/api/treasury/banks/movements", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant-b",
        accountId: "bank-a",
        direction: "IN",
        amount: "10",
        description: "Deposit",
        balance: "999999",
        requestKey: "api-in",
      }),
    }),
    "banks/movements",
    { authorize: async () => actor, operate: async () => {} },
  );
  assert.equal(response.status, 200);
  assert.equal(store.rows("treasuryMovement")[0].tenantId, "tenant-a");
  assert.equal(
    (await accountBalance(store.db, "tenant-a", "bank-a")).toFixed(2),
    "510.00",
  );
});

test("a bank period can close internal manual corrections that net to zero without fabricated statement rows", async (t) => {
  const store = treasuryStore(t);
  setup(store);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const entry = await manualMovement(actor, "BANK", {
    accountId: "bank-a",
    direction: "IN",
    amount: "20",
    description: "Entry error",
    requestKey: "error",
  });
  await reverseManualMovement(actor, {
    id: entry.id,
    reason: "Internal error; no bank transaction",
  });
  const reconciliation = await createReconciliation(actor, {
    accountId: "bank-a",
    periodStart: today,
    periodEnd: today,
    statementOpeningBalance: "500",
    statementClosingBalance: "500",
  });
  assert.equal(
    (await completeReconciliation(actor, reconciliation.id)).status,
    "COMPLETED",
  );
  assert.equal(store.rows("bankStatementLine").length, 0);
});
test("due dates use Ecuador calendar days, so a debt due today is not overdue at noon", () => {
  const due = date("2025-10-13");
  assert.equal(
    obligationState("100", "0", due, new Date("2025-10-13T17:00:00Z")).status,
    "OPEN",
  );
  assert.equal(
    obligationState("100", "0", due, new Date("2025-10-14T05:00:00Z")).status,
    "OVERDUE",
  );
});
