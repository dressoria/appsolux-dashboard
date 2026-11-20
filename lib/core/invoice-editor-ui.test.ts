import assert from "node:assert/strict";
import { resolve } from "node:path";
import test, { mock } from "node:test";
import { Decimal } from "@prisma/client/runtime/library";

type Row = Record<string, unknown> & { id: string; tenantId: string };
const tenantId = "tenant-ui-test";
let drafts: Row[] = [];
let entries: Row[] = [];
let accounts: Row[] = [];
let sales: Row[] = [];
let allowSelection = true;
let authenticated = true;
let userRole = "owner";
const members = [
  { id: "member-a", tenantId, status: "active", role: "owner", user: { id: "user-a", name: "Perfil autenticado", email: "a@example.test", status: "active" } },
  { id: "member-b", tenantId, status: "active", role: "seller", user: { id: "user-b", name: "Vendedora autorizada", email: "b@example.test", status: "active" } },
  { id: "member-inactive", tenantId, status: "disabled", role: "seller", user: { id: "user-disabled", status: "active" } },
  { id: "member-user-inactive", tenantId, status: "active", role: "seller", user: { id: "user-inactive", status: "disabled" } },
  { id: "member-viewer", tenantId, status: "active", role: "viewer", user: { id: "user-viewer", status: "active" } },
  { id: "member-other", tenantId: "other-tenant", status: "active", role: "seller", user: { id: "user-other", status: "active" } },
];
const matches = (row: Row, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => {
  if (value && typeof value === "object" && "in" in value) return (value.in as unknown[]).includes(row[key]);
  return row[key] === value;
});
const db = {
  membership: { findMany: async ({ where }: { where: Record<string, unknown> }) => members.filter((row) => matches(row, where)) },
  businessSettings: { findUnique: async ({ where }: { where: { tenantId: string } }) => { assert.equal(where.tenantId, tenantId); return { selectSellerOnInvoice: allowSelection, editSellerData: false }; } },
  salesInvoiceDraft: {
    create: async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, id: `draft-${drafts.length}`, tenantId: String(data.tenantId), status: "DRAFT" }; drafts.push(row); return row; },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => drafts.find((row) => matches(row, where)) ?? null,
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { const row = drafts.find((item) => matches(item, where)); assert.ok(row); Object.assign(row, data); return row; },
  },
  lightweightSale: { findFirst: async ({ where }: { where: Record<string, unknown> }) => sales.find((row) => matches(row, where)) ?? null },
  accountingJournalEntry: { findFirst: async ({ where }: { where: Record<string, unknown> }) => entries.find((row) => matches(row, where)) ?? null },
  accountingAccount: { findMany: async ({ where }: { where: Record<string, unknown> }) => accounts.filter((row) => matches(row, where)) },
};
let sellerService: typeof import("./invoice-sellers");
let createDraft: typeof import("../../app/api/facturacion/drafts/route");
let draftApi: typeof import("../../app/api/facturacion/drafts/[draftId]/route");
let journalApi: typeof import("../../app/api/basic/sales/[saleId]/journal/route");

test.before(async () => {
  mock.module(resolve("lib/security/server-only.ts"), { namedExports: {} });
  mock.module(resolve("lib/db/prisma.ts"), { namedExports: { getPrismaClient: () => db } });
  mock.module(resolve("lib/auth/current-user.ts"), { namedExports: { getCurrentUser: async () => authenticated ? { id: "user-a", role: userRole } : null } });
  mock.module(resolve("lib/tenant/current-tenant.ts"), { namedExports: { getCurrentTenant: async () => ({ id: tenantId }) } });
  sellerService = await import("./invoice-sellers");
  createDraft = await import("../../app/api/facturacion/drafts/route");
  draftApi = await import("../../app/api/facturacion/drafts/[draftId]/route");
  journalApi = await import("../../app/api/basic/sales/[saleId]/journal/route");
});
test.beforeEach(() => { drafts = []; entries = []; accounts = []; sales = []; allowSelection = true; authenticated = true; userRole = "owner"; });
const req = (body: Record<string, unknown>, method = "POST") => new Request("http://localhost/api/facturacion/drafts", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = (draftId: string) => ({ params: Promise.resolve({ draftId }) });
const readJournal = (saleId: string) => journalApi.GET(new Request("http://localhost"), { params: Promise.resolve({ saleId }) });

test("seller options use active members with existing selling permissions in this tenant", async () => {
  const value = await sellerService.getInvoiceSellerContext(tenantId, "user-a");
  assert.deepEqual(value.sellers.map((seller) => seller.id), ["user-a", "user-b"]);
  assert.equal(value.defaultSellerId, "user-a");
  assert.equal(value.sellers[0].name, "Perfil autenticado");
  assert.equal(value.canSelectSeller, true);
  assert.equal((await sellerService.getInvoiceSellerContext(tenantId, "user-other")).defaultSellerId, "");
});

test("draft create, read, update and conversion preserve seller alongside original fields", async () => {
  const payload = { sellerId: "user-b", customerId: "customer", invoiceKind: "EXPORT", sriPaymentCode: "20", notes: "Observación de factura", lines: [{ productId: "product", quantity: 2 }] };
  const response = await createDraft.POST(req({ tenantId: "other-tenant", payload }));
  assert.equal(response.status, 200);
  assert.equal(drafts[0].tenantId, tenantId);
  assert.equal(drafts[0].createdByUserId, "user-a");
  const { draft } = await response.json();
  const reloaded = await draftApi.GET(new Request("http://localhost"), context(draft.id));
  assert.deepEqual((await reloaded.json()).draft.payload, payload);
  const update = await draftApi.PATCH(req({ payload: { ...payload, notes: "Actualizada" } }, "PATCH"), context(draft.id));
  assert.equal(update.status, 200);
  const conversion = await draftApi.PATCH(req({ status: "CONVERTED", convertedSaleId: "sale-test" }, "PATCH"), context(draft.id));
  assert.equal(conversion.status, 200);
  assert.equal((drafts[0].payload as Record<string, unknown>).sellerId, "user-b");
  assert.equal(drafts[0].status, "CONVERTED");
  assert.equal((await draftApi.PATCH(req({ payload }, "PATCH"), context(draft.id))).status, 409);
});

test("legacy draft clients may omit seller; partial payload replacement preserves attribution", async () => {
  assert.equal((await createDraft.POST(req({ payload: { notes: "Legado" } }))).status, 200);
  await createDraft.POST(req({ payload: { sellerId: "user-b", notes: "Nuevo" } }));
  const draft = drafts[1];
  assert.equal((await draftApi.PATCH(req({ payload: [] }, "PATCH"), context(draft.id))).status, 400);
  await draftApi.PATCH(req({ payload: { notes: "Cliente anterior" } }, "PATCH"), context(draft.id));
  assert.equal((draft.payload as Record<string, unknown>).sellerId, "user-b");
  await draftApi.PATCH(req({ payload: { sellerId: "" } }, "PATCH"), context(draft.id));
  assert.equal((draft.payload as Record<string, unknown>).sellerId, "");
});

test("seller changes obey business settings on the backend", async () => {
  allowSelection = false;
  assert.equal((await createDraft.POST(req({ payload: { sellerId: "user-b" } }))).status, 400);
  assert.equal((await createDraft.POST(req({ payload: { sellerId: "user-a" } }))).status, 200);
  assert.equal((await createDraft.POST(req({ payload: { sellerId: "" } }))).status, 200);
  allowSelection = true;
  await createDraft.POST(req({ payload: { sellerId: "user-b" } }));
  allowSelection = false;
  assert.equal((await draftApi.PATCH(req({ payload: { sellerId: "user-b" } }, "PATCH"), context(drafts[2].id))).status, 200);
});

test("drafts reject foreign, inactive, non-selling or malformed seller references", async () => {
  for (const sellerId of ["user-other", "user-disabled", "user-inactive", "user-viewer", 123]) {
    assert.equal((await createDraft.POST(req({ payload: { sellerId } }))).status, 400);
  }
  assert.equal((await createDraft.POST(req({ payload: [] }))).status, 400);
  assert.equal(drafts.length, 0);
});

test("draft reads and updates do not cross tenant boundaries", async () => {
  drafts.push({ id: "foreign", tenantId: "other-tenant", status: "DRAFT", payload: {} });
  assert.equal((await draftApi.GET(new Request("http://localhost"), context("foreign"))).status, 404);
  assert.equal((await draftApi.PATCH(req({ payload: { sellerId: "user-a" } }, "PATCH"), context("foreign"))).status, 404);
  assert.deepEqual(drafts[0].payload, {});
});

function existingJournal(credit = "10.00", status = "POSTED") {
  sales.push({ id: "sale-test", tenantId });
  accounts.push({ id: "account-a", tenantId }, { id: "account-b", tenantId });
  entries.push({
    id: "journal-test", tenantId, number: "EXISTING-ENTRY", description: "Asiento existente", status, sourceType: "SALE", sourceId: "sale-test",
    // Deliberately stale header totals: UI totals must reflect actual stored lines.
    totalDebit: new Decimal(0), totalCredit: new Decimal(0),
    lines: [
      { id: "line-a", tenantId, accountId: "account-a", account: { code: "TEST-A", name: "Cuenta de prueba A" }, debit: new Decimal("10.00"), credit: new Decimal(0) },
      { id: "line-b", tenantId, accountId: "account-b", account: { code: "TEST-B", name: "Cuenta de prueba B" }, debit: new Decimal(0), credit: new Decimal(credit) },
    ],
  });
}

test("journal GET displays real linked accounts and exact sums without writing", async () => {
  existingJournal();
  const response = await readJournal("sale-test");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const { entry } = await response.json();
  assert.equal(entry.number, "EXISTING-ENTRY");
  assert.equal(entry.status, "POSTED");
  assert.equal(entry.lines[0].accountCode, "TEST-A");
  assert.equal(entry.lines[1].accountName, "Cuenta de prueba B");
  assert.equal(entry.totalDebit, "10.00");
  assert.equal(entry.totalCredit, "10.00");
  assert.equal(entry.difference, "0.00");
  assert.equal(entries.length, 1);
});

test("unbalanced real rows retain their difference and draft status", async () => {
  existingJournal("9.99", "DRAFT");
  const { entry } = await (await readJournal("sale-test")).json();
  assert.equal(entry.difference, "0.01");
  assert.equal(entry.status, "DRAFT");
});

test("missing journal returns null; missing or foreign sale returns 404", async () => {
  sales.push({ id: "sale-test", tenantId }, { id: "foreign-sale", tenantId: "other-tenant" });
  const response = await readJournal("sale-test");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { entry: null });
  assert.equal((await readJournal("foreign-sale")).status, 404);
  assert.equal((await readJournal("unknown")).status, 404);
});

test("foreign journal source cannot be read even when sale id matches", async () => {
  existingJournal();
  entries[0].tenantId = "other-tenant";
  assert.deepEqual(await (await readJournal("sale-test")).json(), { entry: null });
});

test("cross-tenant account or line references are never exposed", async () => {
  existingJournal();
  accounts[0].tenantId = "other-tenant";
  let response = await readJournal("sale-test");
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("TEST-A"));
  accounts[0].tenantId = tenantId;
  (entries[0].lines as Array<Record<string, unknown>>)[0].tenantId = "other-tenant";
  response = await readJournal("sale-test");
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("TEST-A"));
});

test("empty journal rows do not fabricate zero totals", async () => {
  existingJournal();
  entries[0].lines = [];
  assert.deepEqual(await (await readJournal("sale-test")).json(), { entry: null });
});

test("journal enforces existing ERP read permission and authentication", async () => {
  existingJournal();
  userRole = "support";
  assert.equal((await readJournal("sale-test")).status, 403);
  authenticated = false;
  assert.equal((await readJournal("sale-test")).status, 401);
  assert.equal((await createDraft.POST(req({ payload: { sellerId: "user-a" } }))).status, 401);
  assert.equal((await draftApi.PATCH(req({ payload: {} }, "PATCH"), context("other"))).status, 401);
});
