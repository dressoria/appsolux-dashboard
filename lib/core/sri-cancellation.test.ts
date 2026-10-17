import assert from "node:assert/strict";
import test, { mock, type TestContext } from "node:test";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { treasuryStore } from "./treasury/test-store";
import { computeHmacSignature, hashBody } from "./purchase-sync-hmac";

let cancellation: typeof import("./sri-cancellation");
let callback: typeof import("../../app/api/internal/sri/cancellations/confirm/route");
test.before(async () => {
  mock.module(resolve("lib/core/tenant-operational-access.ts"), { namedExports: { requireTenantOperationalAccess: async () => undefined } });
  cancellation = await import("./sri-cancellation");
  callback = await import("../../app/api/internal/sri/cancellations/confirm/route");
});
const D = (v: number) => new Prisma.Decimal(v);
const confirmation = { sriConfirmed: true as const, workerId: "worker-a" };
function setup(t: TestContext, status = "SUBMITTED") {
  const store = treasuryStore(t, ["sriDocument", "sriCancellationRequest", "purchaseSriCredential", "lightweightProduct", "lightweightStockMovement", "inventoryWarehouse", "inventoryMovement", "inventoryStockBalance", "accountingJournalEntry", "accountingJournalLine"]);
  store.seed("sriDocument", { id: "doc-a", status: "AUTHORIZED", documentType: "INVOICE", sourceType: "BASIC_SALE", sourceId: "sale-a", customerIdentification: "1790000000001", issuedAt: new Date(), submissionJobs: [] });
  store.seed("sriCancellationRequest", { id: "request-a", sriDocumentId: "doc-a", status, workerId: "worker-a", requestedByUserId: "user-a" });
  store.seed("purchaseSriCredential", { status: "VERIFIED" });
  store.seed("lightweightSale", { id: "sale-a", status: "completed", total: D(115), customerId: "customer-a", items: [] });
  store.seed("lightweightCustomer", { id: "customer-a", balance: D(115) });
  store.seed("lightweightProduct", { id: "product-a", stock: D(8) });
  store.seed("inventoryWarehouse", { id: "original-warehouse", isDefault: false, active: true });
  store.seed("inventoryMovement", { id: "sale-movement", sourceType: "SALE", sourceId: "sale-a", movementType: "SALE", direction: "OUT", quantity: D(2), productId: "product-a", warehouseId: "original-warehouse" });
  store.seed("inventoryStockBalance", { productId: "product-a", warehouseId: "original-warehouse", quantity: D(8) });
  return store;
}
function seedJournal(store: ReturnType<typeof setup>) {
  store.seed("accountingJournalEntry", { id: "entry-a", number: "ASICOM-000000001", description: "Venta", sourceType: "SALE", sourceId: "sale-a", status: "POSTED", totalDebit: D(115), totalCredit: D(115), lines: [
    { accountId: "receivable", debit: D(115), credit: D(0) },
    { accountId: "income", debit: D(0), credit: D(115) },
  ] });
}
function signedRequest(t: TestContext, body: string, tenantId = "tenant-a", jobId = "request-a", workerId = "worker-a") {
  const previous = process.env.PURCHASE_SYNC_INTERNAL_SECRET;
  process.env.PURCHASE_SYNC_INTERNAL_SECRET = "test-only-cancellation-hmac-key";
  t.after(() => { if (previous === undefined) delete process.env.PURCHASE_SYNC_INTERNAL_SECRET; else process.env.PURCHASE_SYNC_INTERNAL_SECRET = previous; });
  const timestamp = String(Date.now());
  return new NextRequest("http://localhost/api/internal/sri/cancellations/confirm", { method: "POST", body, headers: {
    "x-facturom-timestamp": timestamp, "x-facturom-signature": computeHmacSignature(timestamp, jobId, tenantId, hashBody(body)),
    "x-facturom-worker": workerId, "x-facturom-job-id": jobId, "x-facturom-tenant-id": tenantId,
  } });
}

test("deadline uses Guayaquil month, year rollover and the full last millisecond of day 7", () => {
  assert.equal(cancellation.getDeadlineDate("2027-01-01T03:00:00Z").toISOString(), "2027-01-08T04:59:59.999Z");
  assert.equal(cancellation.getDeadlineDate("2026-02-28T18:30:00Z").toISOString(), "2026-03-08T04:59:59.999Z");
  assert.equal(cancellation.getDeadlineDate("2026-01-15T10:00:00Z").toISOString(), "2026-02-08T04:59:59.999Z");
});
test("live SRI verification flag remains true", () => assert.equal(cancellation.LIVE_SRI_CANCELLATION_VERIFICATION_PENDING, true));
for (const status of ["QUEUED", "RUNNING", "SUBMITTED", "HUMAN_VERIFICATION_REQUIRED", "CONFIRMED"]) {
  test(`eligibility rejects a duplicate ${status} request`, async (t) => {
    setup(t, status);
    assert.equal((await cancellation.checkCancellationEligibility("tenant-a", "doc-a")).eligible, false);
  });
}
test("eligibility checks consumer final, authorization, credentials, deadline and tenant", async (t) => {
  const store = setup(t, "FAILED");
  assert.equal((await cancellation.checkCancellationEligibility("tenant-a", "doc-a")).eligible, true);
  assert.equal((await cancellation.checkCancellationEligibility("tenant-b", "doc-a")).eligible, false);
  for (const customerIdentification of ["9999999999999", "9999999999"]) {
    await store.db.sriDocument.update({ where: { id: "doc-a" }, data: { customerIdentification } });
    assert.equal((await cancellation.checkCancellationEligibility("tenant-a", "doc-a")).eligible, false);
  }
  await store.db.sriDocument.update({ where: { id: "doc-a" }, data: { customerIdentification: "1790000000001", status: "DRAFT" } });
  assert.equal((await cancellation.checkCancellationEligibility("tenant-a", "doc-a")).eligible, false);
  await store.db.sriDocument.update({ where: { id: "doc-a" }, data: { status: "AUTHORIZED", issuedAt: new Date("2020-01-01") } });
  assert.equal((await cancellation.checkCancellationEligibility("tenant-a", "doc-a")).eligible, false);
  await store.db.sriDocument.update({ where: { id: "doc-a" }, data: { issuedAt: new Date() } });
  await store.db.purchaseSriCredential.updateMany({ data: { status: "INVALID" } });
  assert.equal((await cancellation.checkCancellationEligibility("tenant-a", "doc-a")).eligible, false);
});
test("two concurrent requests create only one queued request", async (t) => {
  const store = setup(t, "FAILED");
  const input = { tenantId: "tenant-a", sriDocumentId: "doc-a", reasonCode: "EMISSION_ERROR" as const, requestedByUserId: "user-a" };
  const results = await Promise.allSettled([cancellation.requestSriInvoiceCancellation(input), cancellation.requestSriInvoiceCancellation(input)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(store.rows("sriCancellationRequest").filter((r) => r.status === "QUEUED").length, 1);
});
test("submission without verified evidence cannot finalize", async (t) => {
  const store = setup(t);
  const response = await callback.POST(signedRequest(t, JSON.stringify({ requestId: "request-a", tenantId: "tenant-a" })));
  assert.equal(response.status, 409);
  assert.equal(store.rows("sriDocument")[0].status, "AUTHORIZED");
  assert.equal(store.rows("lightweightSale")[0].status, "completed");
  assert.equal(store.rows("lightweightStockMovement").length, 0);
});
for (const status of ["QUEUED", "RUNNING", "FAILED", "NOT_ELIGIBLE", "HUMAN_VERIFICATION_REQUIRED", "CANCELLED_BY_USER"]) {
  test(`verified callback cannot finalize request in ${status}`, async (t) => {
    const store = setup(t, status);
    await assert.rejects(cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation));
    assert.equal(store.rows("sriDocument")[0].status, "AUTHORIZED");
  });
}
test("confirmed callback restores original warehouse, balances, stock and accounting exactly once", async (t) => {
  const store = setup(t); seedJournal(store);
  const originalQuery = store.db.$queryRaw.bind(store.db);
  const locks: string[] = [];
  t.mock.method(store.db, "$queryRaw", async (query: TemplateStringsArray | Prisma.Sql, ...params: unknown[]) => {
    const sql = Array.isArray(query) ? query.join("?") : (query as Prisma.Sql).sql;
    locks.push(sql); return originalQuery(query, ...params);
  });
  const results = await Promise.all([
    cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation),
    cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation),
  ]);
  assert.equal(results.filter((r) => r.alreadyConfirmed).length, 1);
  assert.equal(store.rows("sriDocument")[0].status, "CANCELLED");
  assert.equal(store.rows("sriCancellationRequest")[0].status, "CONFIRMED");
  assert.equal(store.rows("lightweightSale")[0].status, "canceled");
  assert.equal(Number(store.rows("lightweightProduct")[0].stock), 10);
  assert.equal(Number(store.rows("inventoryStockBalance")[0].quantity), 10);
  assert.equal(Number(store.rows("lightweightCustomer")[0].balance), 0);
  const returns = store.rows("inventoryMovement").filter((r) => r.movementType === "SALE_RETURN");
  assert.equal(returns.length, 1); assert.equal(returns[0].warehouseId, "original-warehouse");
  assert.equal(store.rows("lightweightStockMovement").length, 1);
  assert.equal(store.rows("accountingJournalEntry")[0].status, "REVERSED");
  assert.equal(store.rows("accountingJournalEntry").filter((r) => r.sourceType === "REVERSAL").length, 1);
  assert.equal(store.rows("accountingJournalLine").length, 2);
  assert.equal(store.transactions(), 2, "accounting must share the outer transaction");
  assert.ok(locks.some((sql) => sql.includes('FROM "SriDocument"') && sql.includes("FOR UPDATE")));
});
test("accounting failure rolls back document, request, sale, inventory and customer balance", async (t) => {
  const store = setup(t); seedJournal(store); store.failAfter("accountingJournalLine", 0);
  await assert.rejects(cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation), /INJECTED_FAILURE/);
  assert.equal(store.rows("sriDocument")[0].status, "AUTHORIZED");
  assert.equal(store.rows("sriCancellationRequest")[0].status, "SUBMITTED");
  assert.equal(store.rows("accountingJournalEntry")[0].status, "POSTED");
  assert.equal(Number(store.rows("lightweightProduct")[0].stock), 8);
  assert.equal(store.rows("inventoryMovement").length, 1);
  assert.equal(store.rows("lightweightSale")[0].status, "completed");
});
test("already canceled sale does not restore stock or reverse accounting again", async (t) => {
  const store = setup(t);
  await store.db.lightweightSale.update({ where: { id: "sale-a" }, data: { status: "canceled" } });
  await cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation);
  assert.equal(Number(store.rows("lightweightProduct")[0].stock), 8);
  assert.equal(store.rows("lightweightStockMovement").length, 0);
});
test("HMAC, job, worker and tenant checks reject mismatched callbacks", async (t) => {
  const store = setup(t);
  const body = JSON.stringify({ requestId: "request-a", tenantId: "tenant-a", sriConfirmed: true });
  const invalidSignature = signedRequest(t, body); invalidSignature.headers.set("x-facturom-signature", "00".repeat(32));
  assert.equal((await callback.POST(invalidSignature)).status, 403);
  assert.equal((await callback.POST(signedRequest(t, body, "tenant-a", "other-job"))).status, 400);
  assert.equal((await callback.POST(signedRequest(t, body, "tenant-a", "request-a", "other-worker"))).status, 500);
  const otherTenant = JSON.stringify({ requestId: "request-a", tenantId: "tenant-b", sriConfirmed: true });
  assert.equal((await callback.POST(signedRequest(t, otherTenant, "tenant-b"))).status, 500);
  assert.equal((await callback.POST(signedRequest(t, "{"))).status, 400);
  assert.equal((await callback.POST(signedRequest(t, "null"))).status, 400);
  assert.equal(store.rows("sriDocument")[0].status, "AUTHORIZED");
});
test("matching HMAC callback uses the requester as actor and is replay safe", async (t) => {
  const store = setup(t);
  const body = JSON.stringify({ requestId: "request-a", tenantId: "tenant-a", sriConfirmed: true, confirmedByUserId: "forged-user" });
  assert.equal((await callback.POST(signedRequest(t, body))).status, 200);
  const replay = await callback.POST(signedRequest(t, body));
  assert.equal(replay.status, 200); assert.equal((await replay.json()).alreadyConfirmed, true);
  assert.equal(store.rows("inventoryMovement")[1].createdByUserId, "user-a");
});

function seedCollection(store: ReturnType<typeof setup>, type: "BANK" | "CARD" = "BANK") {
  store.seed("treasuryAccount", { id: "collection-account", type, openingBalance: D(500) });
  store.seed("lightweightPayment", { id: "payment-a", saleId: "sale-a", amount: D(115), method: type === "CARD" ? "card" : "transfer" });
  store.seed("treasuryMovement", { id: "collection-a", accountId: "collection-account", salePaymentId: "payment-a", direction: "IN", movementType: type === "CARD" ? "CARD_COLLECTION" : "SALE_COLLECTION", sourceType: "SALE_PAYMENT", sourceId: "payment-a", amount: D(115) });
  store.seed("treasuryObligation", { id: "obligation-a", saleId: "sale-a", status: "PAID", originalAmount: D(115), paidAmount: D(115), balance: D(0) });
  if (type === "CARD") store.seed("cardTransaction", { id: "card-a", saleId: "sale-a", status: "PENDING", cardAccountId: "collection-account" });
}
test("concurrent confirmations reverse a paid sale's treasury collection only once without a web session", async (t) => {
  const store = setup(t); seedCollection(store);
  await Promise.all([cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation), cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation)]);
  const movements = store.rows("treasuryMovement");
  assert.equal(movements.length, 2);
  const reversal = movements.find((m) => m.sourceType === "REVERSAL")!;
  assert.equal(reversal.reversalOfId, "collection-a"); assert.equal(reversal.direction, "OUT"); assert.equal(Number(reversal.amount), 115);
  assert.equal(store.rows("treasuryObligation")[0].status, "CANCELLED");
  assert.equal(Number(store.rows("treasuryObligation")[0].paidAmount), 0);
});
test("later accounting failure also rolls back treasury compensation", async (t) => {
  const store = setup(t); seedCollection(store); seedJournal(store); store.failAfter("accountingJournalLine", 0);
  await assert.rejects(cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation), /INJECTED_FAILURE/);
  assert.equal(store.rows("treasuryMovement").length, 1);
  assert.equal(store.rows("treasuryObligation")[0].status, "PAID");
  assert.equal(store.rows("sriDocument")[0].status, "AUTHORIZED");
});
test("pending card collection is compensated and canceled once", async (t) => {
  const store = setup(t); seedCollection(store, "CARD");
  await cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation);
  await cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation);
  assert.equal(store.rows("cardTransaction")[0].status, "CANCELLED");
  assert.equal(store.rows("treasuryMovement").length, 2);
});
test("settled cards and applied advances fail atomically for linked refund handling", async (t) => {
  const store = setup(t); seedCollection(store, "CARD");
  await store.db.cardTransaction.update({ where: { id: "card-a" }, data: { status: "SETTLED" } });
  await assert.rejects(cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation), /tarjetas acreditadas/);
  assert.equal(store.rows("treasuryMovement").length, 1);
  assert.equal(store.rows("lightweightSale")[0].status, "completed");
  await store.db.cardTransaction.update({ where: { id: "card-a" }, data: { status: "PENDING" } });
  store.seed("advanceApplication", { obligationId: "obligation-a" });
  await assert.rejects(cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation), /anticipos o cheques/);
  assert.equal(store.rows("sriCancellationRequest")[0].status, "SUBMITTED");
});

test("a request cannot finalize a document linked to a different tenant", async (t) => {
  const store = setup(t);
  await store.db.sriDocument.update({ where: { id: "doc-a" }, data: { tenantId: "tenant-b" } });
  await assert.rejects(cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation), /no encontrada/);
  assert.equal(store.rows("sriDocument")[0].status, "AUTHORIZED");
  assert.equal(store.rows("lightweightStockMovement").length, 0);
});
test("two distinct requests for the same invoice cannot duplicate returns or reversals", async (t) => {
  const store = setup(t); seedCollection(store); seedJournal(store);
  store.seed("sriCancellationRequest", { id: "request-duplicate", sriDocumentId: "doc-a", status: "SUBMITTED", workerId: "worker-a", requestedByUserId: "user-a" });
  const results = await Promise.allSettled([
    cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-a", confirmation),
    cancellation.finalizeSriInvoiceCancellation("tenant-a", "request-duplicate", confirmation),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(store.rows("lightweightStockMovement").length, 1);
  assert.equal(store.rows("treasuryMovement").filter((m) => m.sourceType === "REVERSAL").length, 1);
  assert.equal(store.rows("accountingJournalEntry").filter((e) => e.sourceType === "REVERSAL").length, 1);
});
