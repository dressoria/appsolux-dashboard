import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { AppsoluxUser } from "@/types/user";
import { API_SCOPES } from "./catalog";
import { generateApiKey } from "./crypto";
import { integrationApi } from "./gateway";
import { authenticateApiKey } from "./auth";
import { createManagedKey, changeManagedKey, listManagement, managementHttp } from "./management";
import { rateLimit, claimIdempotency, finishIdempotency } from "./persistence";
import { object } from "./errors";
import { API_ROUTES } from "./routes";

const testUrl = process.env.FACTUROM_API_TEST_DATABASE_URL;
const enabled = !!testUrl;
let db: PrismaClient;
let tenantId: string, otherTenantId: string, owner: AppsoluxUser, otherUser: AppsoluxUser;
let secret: string, keyId: string, productId: string, foreignProductId: string, customerId: string, foreignCustomerId: string, warehouseId: string, secondWarehouseId: string, documentId: string, accountId: string, expenseAccountId: string;
const runId = randomUUID().slice(0, 8);
const currentUser = async () => owner;
const it = (name: string, fn: () => Promise<void>) => test(name, { skip: !enabled }, fn);
async function request(path: string, method = "GET", body?: unknown, options: { secret?: string; idem?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { Authorization: `Bearer ${options.secret ?? secret}`, ...options.headers };
  if (method !== "GET") { headers["Content-Type"] = "application/json"; headers["Idempotency-Key"] = options.idem ?? randomUUID(); }
  const response = await integrationApi(new Request(`http://localhost/api/v1/${path}`, { method, headers, ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }) }), path.split("?")[0]);
  const json = object(await response.json());
  return { response, json, data: Array.isArray(json.data) ? { items: json.data } : json.data && typeof json.data === "object" ? object(json.data) : {}, error: json.error ? object(json.error) : {} };
}
before(async () => {
  if (!enabled) return;
  const target = new URL(testUrl!);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !target.pathname.endsWith("_test")) throw new Error("Integration tests require an explicit local *_test database.");
  process.env.DATABASE_URL = testUrl;
  const { getPrismaClient } = await import("@/lib/db/prisma"); db = getPrismaClient();
  const { defaultPlanDefinitions } = await import("@/lib/core/plans");
  const plan = await db.plan.upsert({ where: { key: "pro" }, update: {}, create: { key: "pro", name: "Integration test plan", limits: defaultPlanDefinitions.pro.limits, features: defaultPlanDefinitions.pro.features } });
  const a = await db.tenant.create({ data: { name: `API test ${runId}`, slug: `api-test-${runId}`, status: "active", planKey: "pro", subscriptions: { create: { planId: plan.id, status: "manual" } } } }); tenantId = a.id;
  const b = await db.tenant.create({ data: { name: `Other ${runId}`, slug: `api-other-${runId}`, status: "active", planKey: "pro", subscriptions: { create: { planId: plan.id, status: "manual" } } } }); otherTenantId = b.id;
  const u = await db.user.create({ data: { name: "API owner", email: `api-${runId}@example.test`, status: "active", memberships: { create: { tenantId, role: "owner", status: "active" } } } });
  owner = { id: u.id, name: u.name, email: u.email, role: "owner", tenant: { id: tenantId, name: a.name, slug: a.slug, chatwoot_account_id: 0, channels: {} } };
  const u2 = await db.user.create({ data: { name: "Other user", email: `other-${runId}@example.test`, status: "active", memberships: { create: { tenantId: otherTenantId, role: "owner", status: "active" } } } });
  otherUser = { id: u2.id, name: u2.name, email: u2.email, role: "owner", tenant: { id: otherTenantId, name: b.name, slug: b.slug, chatwoot_account_id: 0, channels: {} } };
  const generated = generateApiKey(); secret = generated.secret;
  const key = await db.userApiKey.create({ data: { tenantId, userId: u.id, name: "Integration test", keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, scopes: API_SCOPES.map(s => s.id), fullAccess: true } }); keyId = key.id;
  const warehouse = await db.inventoryWarehouse.create({ data: { tenantId, code: "MAIN", name: "Main", isDefault: true } }); warehouseId = warehouse.id;
  secondWarehouseId = (await db.inventoryWarehouse.create({ data: { tenantId, code: "SECOND", name: "Second" } })).id;
  const product = await db.lightweightProduct.create({ data: { tenantId, name: "Real test service", primaryCode: "TEST-1", price: 10, taxRate: 15, type: "SERVICE", trackInventory: false } }); productId = product.id;
  foreignProductId = (await db.lightweightProduct.create({ data: { tenantId: otherTenantId, name: "PRIVATE OTHER TENANT", price: 999, type: "SERVICE" } })).id;
  const c = await db.lightweightCustomer.create({ data: { tenantId, name: "Integration customer", identificationType: "PASSPORT", identification: `PASS-${runId}` } }); customerId = c.id;
  foreignCustomerId = (await db.lightweightCustomer.create({ data: { tenantId: otherTenantId, name: "PRIVATE CUSTOMER" } })).id;
  const profile = await db.sriTaxpayerProfile.create({ data: { tenantId, legalName: "API TEST", ruc: "1790016919001", environment: "TEST" } });
  const est = await db.sriEstablishment.create({ data: { tenantId, profileId: profile.id, code: "001", name: "Main", address: "Test" } });
  const issue = await db.sriIssuePoint.create({ data: { tenantId, establishmentId: est.id, code: "001", name: "Test" } });
  documentId = (await db.sriDocument.create({ data: { tenantId, establishmentId: est.id, issuePointId: issue.id, sourceType: "BASIC_SALE", documentType: "INVOICE", customerName: c.name, subtotal: 10, taxTotal: 1.5, grandTotal: 11.5, status: "DRAFT" } })).id;
  const accountingPlan = await db.accountingPlan.create({ data: { tenantId, name: "Test chart", status: "ACTIVE", createdByUserId: u.id } });
  accountId = (await db.accountingAccount.create({ data: { tenantId, planId: accountingPlan.id, code: "1.1", name: "Cash", rootType: "ASSET", normalBalance: "DEBIT" } })).id;
  expenseAccountId = (await db.accountingAccount.create({ data: { tenantId, planId: accountingPlan.id, code: "4.1", name: "Revenue", rootType: "INCOME", normalBalance: "CREDIT" } })).id;
});
after(async () => { if (db) await db.$disconnect(); });

it("PostgreSQL: Full Access administration creates hashed key and never lists secrets", async () => {
  const created = await createManagedKey({ tenantId, name: "n8n Full", fullAccess: true, scopes: ["forged"] }, currentUser);
  assert.ok(created.secret); assert.equal(created.key.scopes.length, API_SCOPES.length); assert.equal(created.key.fullAccess, true);
  const stored = await db.userApiKey.findUniqueOrThrow({ where: { id: created.key.id } }); assert.notEqual(stored.keyHash, created.secret); assert.ok(!("secret" in stored));
  const listed = await listManagement(tenantId, currentUser); assert.ok(!JSON.stringify(listed).includes(created.secret)); assert.ok(!JSON.stringify(listed).includes(stored.keyHash));
  await assert.rejects(createManagedKey({ tenantId: otherTenantId, name: "Attack", fullAccess: true }, currentUser), { status: 403 });
});
it("PostgreSQL: read APIs return real records and isolate the tenant", async () => {
  const p = await request("products?pageSize=1"); assert.equal(p.response.status, 200); assert.ok((p.data.items as { id: string }[]).every(i => i.id !== foreignProductId)); assert.equal((p.data.items as unknown[]).length, 1);
  const c = await request("customers"); assert.equal(c.response.status, 200); assert.ok(JSON.stringify(c.data).includes(customerId)); assert.ok(!JSON.stringify(c.data).includes(foreignCustomerId));
  assert.equal((await request(`products/${productId}`)).response.status, 200);
  assert.equal((await request(`customers/${customerId}`)).response.status, 200);
  assert.equal((await request(`invoices/${documentId}`)).response.status, 200);
  const other = await request(`products/${foreignProductId}`); assert.equal(other.response.status, 404);
  assert.equal((await request(`customers/${foreignCustomerId}`)).response.status, 404);
});
it("PostgreSQL: create product and client through actual business services", async () => {
  const p = await request("products", "POST", { name: "API-created service", primaryCode: `API-${runId}`, type: "SERVICE", price: 20, taxRate: 15, trackInventory: false });
  assert.equal(p.response.status, 201, JSON.stringify(p.json)); assert.ok(await db.lightweightProduct.findFirst({ where: { id: String(p.data.id), tenantId } }));
  const c = await request("customers", "POST", { name: "Created via API", identificationType: "PASSPORT", identification: `CREATED-${runId}` });
  assert.equal(c.response.status, 201, JSON.stringify(c.json)); assert.ok(await db.lightweightCustomer.findFirst({ where: { id: String(c.data.id), tenantId } }));
});
it("PostgreSQL: proforma uses server prices, persists and respects foreign customer/product checks", async () => {
  const before = await db.lightweightProforma.count({ where: { tenantId } });
  const result = await request("proformas", "POST", { customerId, items: [{ productId, quantity: 2 }] });
  assert.equal(result.response.status, 201, JSON.stringify(result.json)); assert.equal(result.data.total, "23");
  const saved = await db.lightweightProforma.findFirstOrThrow({ where: { id: String(result.data.id), tenantId }, include: { items: true } }); assert.equal(Number(saved.items[0].unitPrice), 10);
  assert.equal((await request("proformas")).response.status, 200);
  assert.equal((await request(`proformas/${result.data.id}`)).response.status, 200);
  const edited = await request(`proformas/${result.data.id}`, "PATCH", { customerId, items: [{ productId, quantity: 3 }] }); assert.equal(edited.response.status, 200, JSON.stringify(edited.json)); assert.equal(edited.data.total, "34.5");
  for (const body of [{ customerId: foreignCustomerId, items: [{ productId, quantity: 1 }] }, { customerId, items: [{ productId: foreignProductId, quantity: 1 }] }]) assert.equal((await request("proformas", "POST", body)).response.status, 404);
  assert.equal(await db.lightweightProforma.count({ where: { tenantId } }), before + 1);
});
it("PostgreSQL: HTTP overrides of tenant, user, privilege and related IDs fail", async () => {
  for (const path of ["products?tenantId=other", "products?tenant_id=other"]) assert.equal((await request(path)).response.status, 400);
  assert.equal((await request("products", "GET", undefined, { headers: { "X-Tenant-Id": otherTenantId } })).response.status, 400);
  assert.equal((await request("customers", "POST", { name: "Bad", tenantId: otherTenantId })).response.status, 400);
  assert.equal((await request("products", "POST", { name: "Bad", categoryId: "nonexistent" })).response.status, 404);
  assert.equal((await request("sales", "POST", { customerId: foreignCustomerId, paymentMethod: "cash", items: [{ productId, quantity: 1 }] })).response.status, 404);
  assert.equal((await request(`customers/${foreignCustomerId}`, "PATCH", { email: "stolen@example.test" })).response.status, 404);
  assert.equal((await request(`products/${foreignProductId}`, "DELETE", {})).response.status, 404);
  assert.equal((await db.lightweightProduct.findUniqueOrThrow({ where: { id: foreignProductId } })).isActive, true);
});
it("PostgreSQL: PATCH supports partial contacts and scope checks cover destructive field changes", async () => {
  const updated = await request(`customers/${customerId}`, "PATCH", { email: "updated@example.test" }); assert.equal(updated.response.status, 200, JSON.stringify(updated.json));
  const key = await createManagedKey({ tenantId, name: "Edit only", scopes: ["products:update"] }, currentUser);
  assert.equal((await request(`products/${productId}`, "PATCH", { isActive: false }, { secret: key.secret })).response.status, 403);
  assert.equal((await request(`products/${productId}`, "PATCH", { price: 99 }, { secret: key.secret })).response.status, 403);
  assert.equal((await db.lightweightProduct.findUniqueOrThrow({ where: { id: productId } })).isActive, true);
});
it("PostgreSQL: durable idempotency replays a real sale, rejects payload changes and survives a new Prisma client", async () => {
  const idem = `sale-${runId}`, body = { customerId, paymentMethod: "credit", paidAmount: 0, items: [{ productId, quantity: 1 }] };
  const first = await request("sales", "POST", body, { idem }); assert.equal(first.response.status, 201, JSON.stringify(first.json));
  const second = await request("sales", "POST", body, { idem }); assert.equal(second.response.status, 201); assert.deepEqual(second.json, first.json); assert.equal(second.response.headers.get("Idempotency-Replayed"), "true");
  assert.equal((await request("sales", "POST", { ...body, paidAmount: 1 }, { idem })).response.status, 409);
  assert.equal(await db.lightweightSale.count({ where: { id: String(first.data.id), tenantId } }), 1);
  const { PrismaClient } = await import("@prisma/client"); const independent = new PrismaClient();
  assert.ok(await independent.apiIdempotencyRecord.findFirst({ where: { apiKeyId: keyId, status: "COMPLETED" } })); await independent.$disconnect();
});
it("PostgreSQL: concurrent retries create only one customer", async () => {
  const idem = `concurrent-${runId}`, name = `Concurrent ${runId}`;
  const results = await Promise.all(Array.from({ length: 4 }, () => request("customers", "POST", { name, identificationType: "PASSPORT", identification: `CON-${runId}` }, { idem })));
  assert.equal(results.filter(r => r.response.status === 201 && !r.response.headers.has("Idempotency-Replayed")).length, 1);
  assert.ok(results.every(r => [201, 409].includes(r.response.status)), JSON.stringify(results.map(r => r.json)));
  assert.equal(await db.lightweightCustomer.count({ where: { tenantId, name } }), 1);
});
it("PostgreSQL: all available list/report modules execute real queries", async () => {
  const paths = ["inventory/stock", "inventory/warehouses", "inventory/movements", "inventory/transfers", "inventory/physical-counts", "inventory/categories", "inventory/brands", "inventory/units", "inventory/valuation", "inventory/shipping-guides", "inventory/vehicles", "sri/sync-jobs", "sri/received", "sri/issued", `inventory/kardex?productId=${productId}`, "suppliers", "sales", "sales/orders", "invoices", "sri/documents", `sri/documents/${documentId}/jobs`, "purchases", "purchases/receipts", "purchases/orders", "credit-notes", "debit-notes", "treasury/cash", "treasury/banks", "treasury/movements", "treasury/receivables", "treasury/payables", "accounting/accounts", "accounting/journal", "accounting/periods", "reports/sales", "reports/inventory", "reports/purchases", "reports/financial", "settings/company", "users", "me"];
  for (const path of paths) { const r = await request(path); assert.equal(r.response.status, 200, `${path}: ${JSON.stringify(r.json)}`); assert.ok(!JSON.stringify(r.json).includes(foreignProductId)); }
  for (const kind of ["trial-balance", "balance-sheet", "income-statement", "ledger"]) { const r = await request(`accounting/reports/${kind}?from=2026-01-01&to=2026-12-31&accountId=${accountId}`); assert.equal(r.response.status, 200, JSON.stringify(r.json)); }
});
it("PostgreSQL: inventory adjustments, transfers, counts and receipts use persisted balances", async () => {
  const key = await createManagedKey({ tenantId, name: "Inventory flow", fullAccess: true }, currentUser);
  const call = (path: string, method = "GET", body?: unknown) => request(path, method, body, { secret: key.secret });
  const product = await call("products", "POST", { name: "Stock item", primaryCode: `STOCK-${runId}`, price: 12, type: "PRODUCT", defaultWarehouseId: warehouseId });
  assert.equal(product.response.status, 201, JSON.stringify(product.json)); const id = String(product.data.id);
  const adjusted = await call("inventory/adjustments", "POST", { productId: id, warehouseId, quantity: 5, type: "ADJUSTMENT_IN" }); assert.equal(adjusted.response.status, 201, JSON.stringify(adjusted.json));
  assert.equal((await db.lightweightProduct.findUniqueOrThrow({ where: { id } })).stock, 5);
  const transfer = await call("inventory/transfers", "POST", { sourceWarehouseId: warehouseId, destinationWarehouseId: secondWarehouseId, items: [{ productId: id, quantity: 2 }] }); assert.equal(transfer.response.status, 201, JSON.stringify(transfer.json));
  assert.equal((await call(`inventory/transfers/${transfer.data.id}/complete`, "POST", {})).response.status, 200);
  const balance = await db.inventoryStockBalance.findFirstOrThrow({ where: { tenantId, warehouseId, productId: id } }); assert.equal(Number(balance.quantity), 3);
  const count = await call("inventory/physical-counts", "POST", { warehouseId }); assert.equal(count.response.status, 201);
  assert.equal((await call(`inventory/physical-counts/${count.data.id}`)).response.status, 200);
  assert.equal((await call(`inventory/physical-counts/${count.data.id}`, "PATCH", { productId: id, countedQuantity: 4 })).response.status, 200);
  assert.equal((await call(`inventory/physical-counts/${count.data.id}/complete`, "POST", {})).response.status, 200);
  assert.equal((await db.lightweightProduct.findUniqueOrThrow({ where: { id } })).stock, 6);
  const receipt = await call("purchases/receipts", "POST", { warehouseId, items: [{ productId: id, quantityExpected: 2, quantityReceived: 2 }] }); assert.equal(receipt.response.status, 201);
  assert.equal((await call(`purchases/receipts/${receipt.data.id}/confirm`, "POST", {})).response.status, 200);
  assert.equal((await db.lightweightProduct.findUniqueOrThrow({ where: { id } })).stock, 8);
  const stock = await call(`inventory/stock?productId=${id}`); assert.equal((stock.data.items as unknown[]).length, 2);
});
it("PostgreSQL: operational catalogs, suppliers, prices, orders and draft notes execute shared services", async () => {
  const key = await createManagedKey({ tenantId, name: "Catalog writes", fullAccess: true }, currentUser);
  const call = (path: string, method = "GET", body?: unknown) => request(path, method, body, { secret: key.secret });
  for (const kind of ["categories", "brands", "units"]) {
    const created = await call(`inventory/${kind}`, "POST", { name: `API ${kind}`, ...(kind === "units" ? { code: `U-${runId}`, abbreviation: "u" } : {}) }); assert.equal(created.response.status, 201, JSON.stringify(created.json));
    assert.equal((await call(`inventory/${kind}/${created.data.id}`, "PATCH", { name: `Updated ${kind}` })).response.status, 200);
  }
  const supplier = await call("suppliers", "POST", { name: "API supplier", identificationType: "PASSPORT", identification: `SUP-${runId}` }); assert.equal(supplier.response.status, 201, JSON.stringify(supplier.json));
  assert.equal((await call(`suppliers/${supplier.data.id}`, "PATCH", { name: "Updated supplier" })).response.status, 200);
  const purchaseOrder = await call("purchases/orders", "POST", { supplierId: supplier.data.id, warehouseId, items: [{ productId, requestedQuantity: 1, unitCostEstimate: 10 }] }); assert.equal(purchaseOrder.response.status, 201);
  const vehicle = await call("inventory/vehicles", "POST", { plate: `API-${runId}`, brand: "Test", year: 2026 }); assert.equal(vehicle.response.status, 201);
  assert.equal((await call(`inventory/vehicles/${vehicle.data.id}`, "PATCH", { plate: `API-${runId}`, color: "Azul" })).response.status, 200);
  const guide = await call("inventory/shipping-guides", "POST", { vehicleId: vehicle.data.id, sourceWarehouseId: warehouseId, issueDate: "2026-11-09", startTransportDate: "2026-11-09", originAddress: "Origin", destinationAddress: "Destination", reason: "Delivery", items: [{ productId, code: "TEST", description: "Service", quantity: 1 }] }); assert.equal(guide.response.status, 201, JSON.stringify(guide.json));
  assert.equal((await call(`inventory/shipping-guides/${guide.data.id}`)).response.status, 200);
  assert.equal((await call(`inventory/shipping-guides/${guide.data.id}`, "PATCH", { status: "ISSUED" })).response.status, 200);
  const price = await call("products/prices", "POST", { channel: "price", changes: [{ productId, oldPrice: 10, newPrice: 12 }] }); assert.equal(price.response.status, 200, JSON.stringify(price.json));
  assert.equal(Number((await db.lightweightProduct.findUniqueOrThrow({ where: { id: productId } })).price), 12);
  const items = [{ productId, productName: "Service", quantity: 1, unitPrice: 10, subtotal: 10, taxRate: 15, tax: 1.5, total: 11.5 }];
  const order = await call("sales/orders", "POST", { customerId, items, subtotal: 10, tax: 1.5, total: 11.5 }); assert.equal(order.response.status, 201, JSON.stringify(order.json));
  assert.equal((await call(`sales/orders/${order.data.id}`)).response.status, 200);
  assert.equal((await call(`sales/orders/${order.data.id}/confirm`, "POST", {})).response.status, 200);
  assert.equal((await call(`sales/orders/${order.data.id}/cancel`, "POST", {})).response.status, 200);
  await db.sriDocument.update({ where: { id: documentId }, data: { status: "AUTHORIZED" } });
  const credit = await call("credit-notes", "POST", { sourceSriDocumentId: documentId, reason: "Test return", items, subtotal: 10, tax: 1.5, total: 11.5 }); assert.equal(credit.response.status, 201, JSON.stringify(credit.json));
  const debit = await call("debit-notes", "POST", { sourceSriDocumentId: documentId, reasons: [{ description: "Test interest", amount: 1, taxRate: 0, tax: 0, total: 1 }], tax: 0, total: 1 }); assert.equal(debit.response.status, 201, JSON.stringify(debit.json));
  assert.equal((await db.salesCreditNote.findUniqueOrThrow({ where: { id: String(credit.data.id) } })).status, "DRAFT");
  await db.sriDocument.update({ where: { id: documentId }, data: { status: "DRAFT" } });
});
it("PostgreSQL: treasury cash sessions, transfers and collections move balances through the existing ledger", async () => {
  const key = await createManagedKey({ tenantId, name: "Treasury flow", fullAccess: true }, currentUser);
  const call = (path: string, method = "GET", body?: unknown) => request(path, method, body, { secret: key.secret });
  const bank = await call("treasury/banks", "POST", { name: `API bank ${runId}`, bankName: "Test bank", accountName: "Integration", openingBalance: "100.00", openingDate: "2026-01-01" }); assert.equal(bank.response.status, 201, JSON.stringify(bank.json));
  const cash = await call("treasury/cash", "POST", { name: `API cash ${runId}`, openingBalance: "0.00", openingDate: "2026-01-01" }); assert.equal(cash.response.status, 201, JSON.stringify(cash.json));
  const cashId = String(cash.data.id), bankId = String(bank.data.id);
  const bank2 = await call("treasury/banks", "POST", { name: `API bank2 ${runId}`, bankName: "Test bank", accountName: "Integration", openingBalance: "0.00", openingDate: "2026-01-01" }); assert.equal(bank2.response.status, 201);
  assert.equal((await call("treasury/cash/sessions", "POST", { accountId: cashId, action: "open" })).response.status, 201);
  const transferred = await call("treasury/transfers", "POST", { fromAccountId: bankId, toAccountId: String(bank2.data.id), amount: "10.00", requestKey: `transfer-${runId}` }); assert.equal(transferred.response.status, 201, JSON.stringify(transferred.json));
  assert.equal((await call("treasury/cash/sessions", "POST", { accountId: cashId, action: "close", countedAmount: "0.00" })).response.status, 201);
  const obligation = await db.treasuryObligation.create({ data: { tenantId, type: "RECEIVABLE", customerId, documentType: "OPENING_OBLIGATION", externalReference: `test-${runId}`, issueDate: new Date("2026-01-01"), dueDate: new Date("2026-12-31"), originalAmount: 10, paidAmount: 0, balance: 10, status: "OPEN", createdByUserId: owner.id } });
  const collected = await call(`treasury/receivables/${obligation.id}/collect`, "POST", { accountId: bankId, method: "transfer", requestKey: `collect-${runId}`, amount: "10.00" }); assert.equal(collected.response.status, 201, JSON.stringify(collected.json));
  assert.equal(Number((await db.treasuryObligation.findUniqueOrThrow({ where: { id: obligation.id } })).balance), 0);
  const supplier = await db.lightweightSupplier.findFirstOrThrow({ where: { tenantId, isActive: true } });
  const payable = await db.treasuryObligation.create({ data: { tenantId, type: "PAYABLE", supplierId: supplier.id, documentType: "OPENING_OBLIGATION", externalReference: `payable-${runId}`, issueDate: new Date("2026-01-01"), dueDate: new Date("2026-12-31"), originalAmount: 5, paidAmount: 0, balance: 5, status: "OPEN", createdByUserId: owner.id } });
  const paid = await call(`treasury/payables/${payable.id}/pay`, "POST", { accountId: bankId, method: "transfer", requestKey: `pay-${runId}`, amount: "5.00" }); assert.equal(paid.response.status, 201, JSON.stringify(paid.json));
  assert.equal(Number((await db.treasuryObligation.findUniqueOrThrow({ where: { id: payable.id } })).balance), 0);
});
it("PostgreSQL: resource edits, soft deletion, sales collection and warehouse capacity execute real flows", async () => {
  const key = await createManagedKey({ tenantId, name: "CRUD and capacity", fullAccess: true }, currentUser);
  const call = (path: string, method = "GET", body?: unknown) => request(path, method, body, { secret: key.secret });
  const warehouse = await call("inventory/warehouses", "POST", { code: "THIRD", name: "Third warehouse" }); assert.equal(warehouse.response.status, 201, JSON.stringify(warehouse.json));
  assert.equal((await call(`inventory/warehouses/${warehouse.data.id}`, "PATCH", { name: "Third updated" })).response.status, 200);
  const exceeded = await call("inventory/warehouses", "POST", { code: "FOURTH", name: "Over plan limit" }); assert.equal(exceeded.response.status, 403); assert.equal(exceeded.error.code, "PLAN_LIMIT");
  const product = await call("products", "POST", { name: "Disposable service", primaryCode: `DELETE-${runId}`, price: 7, type: "SERVICE" }); assert.equal(product.response.status, 201);
  assert.equal((await call(`products/${product.data.id}`, "PATCH", { name: "Edited service", price: 8 })).response.status, 200);
  assert.equal((await call(`products/${product.data.id}`, "DELETE", {})).response.status, 200);
  assert.equal((await db.lightweightProduct.findUniqueOrThrow({ where: { id: String(product.data.id) } })).isActive, false);
  const customer = await call("customers", "POST", { name: "Disposable customer", identificationType: "PASSPORT", identification: `DEL-${runId}` }); assert.equal(customer.response.status, 201);
  assert.equal((await call(`customers/${customer.data.id}`, "DELETE", {})).response.status, 200);
  const supplier = await call("suppliers", "POST", { name: "Disposable supplier", identificationType: "PASSPORT", identification: `DEL-S-${runId}` }); assert.equal(supplier.response.status, 201);
  assert.equal((await call(`suppliers/${supplier.data.id}`, "DELETE", {})).response.status, 200);
  const sale = await call("sales", "POST", { customerId, paymentMethod: "credit", paidAmount: 0, items: [{ productId, quantity: 1 }] }); assert.equal(sale.response.status, 201, JSON.stringify(sale.json));
  assert.equal((await call(`sales/${sale.data.id}`)).response.status, 200);
  const bank = await db.treasuryAccount.findFirstOrThrow({ where: { tenantId, type: "BANK" } });
  const collection = await call(`sales/${sale.data.id}/payments`, "POST", { method: "transfer", amount: 5, treasuryAccountId: bank.id }); assert.equal(collection.response.status, 201, JSON.stringify(collection.json));
  const blocked = await call(`sales/${sale.data.id}/cancel`, "POST", {}); assert.equal(blocked.response.status, 409, JSON.stringify(blocked.json));
  const unpaid = await call("sales", "POST", { customerId, paymentMethod: "credit", paidAmount: 0, items: [{ productId, quantity: 1 }] }); assert.equal(unpaid.response.status, 201);
  const canceled = await call(`sales/${unpaid.data.id}/cancel`, "POST", {}); assert.equal(canceled.response.status, 200, JSON.stringify(canceled.json));
  assert.equal((await db.lightweightSale.findUniqueOrThrow({ where: { id: String(unpaid.data.id) } })).status, "canceled");
});
it("PostgreSQL: SRI errors remain real validation failures; no simulated authorization or file", async () => {
  const key = await createManagedKey({ tenantId, name: "SRI validation", fullAccess: true }, currentUser);
  const call = (path: string, method = "GET", body?: unknown) => request(path, method, body, { secret: key.secret });
  assert.equal((await call(`invoices/${documentId}/xml`)).response.status, 422);
  assert.equal((await call(`invoices/${documentId}/ride`)).response.status, 422);
  assert.equal((await call(`sri/documents/${documentId}/sign`, "POST", {})).response.status, 422);
  assert.equal((await call(`sri/documents/${documentId}/submit`, "POST", {})).response.status, 422);
  assert.equal((await call(`sri/documents/${documentId}/cancel`, "POST", { reasonCode: "EMISSION_ERROR" })).response.status, 422);
  const sale = await db.lightweightSale.findFirstOrThrow({ where: { tenantId } });
  await db.sriDocument.update({ where: { id: documentId }, data: { sourceId: sale.id } });
  const blocked = await call(`sales/${sale.id}/cancel`, "POST", {}); assert.equal(blocked.response.status, 422); assert.equal(blocked.error.code, "SRI_CANCELLATION_REQUIRED");
  assert.notEqual((await db.lightweightSale.findUniqueOrThrow({ where: { id: sale.id } })).status, "canceled");
  assert.equal((await call("invoices", "POST", { saleId: "foreign-or-absent" })).response.status, 404);
  const invoicingSale = await call("sales", "POST", { customerId, paymentMethod: "credit", paidAmount: 0, items: [{ productId, quantity: 1 }] }); assert.equal(invoicingSale.response.status, 201, JSON.stringify(invoicingSale.json));
  const emission = await call("invoices", "POST", { saleId: invoicingSale.data.id }); assert.equal(emission.response.status, 422, JSON.stringify(emission.json));
  assert.equal(await db.sriDocument.count({ where: { tenantId, sourceId: String(invoicingSale.data.id), status: "AUTHORIZED" } }), 0);
  assert.equal((await call("sri/received/sync", "POST", { from: "2026-11-01", to: "2026-11-09" })).response.status, 422);
});
it("PostgreSQL: scope removal, deactivation and membership revocation take immediate effect", async () => {
  const generated = generateApiKey(); const key = await db.userApiKey.create({ data: { tenantId, userId: owner.id, name: "Restricted", keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, scopes: ["products:read"], fullAccess: true } });
  assert.equal((await request("products", "GET", undefined, { secret: generated.secret })).response.status, 200);
  assert.equal((await request("customers", "GET", undefined, { secret: generated.secret })).response.status, 403);
  await db.membership.update({ where: { userId_tenantId: { userId: owner.id, tenantId } }, data: { role: "viewer" } });
  assert.equal((await request("products", "POST", { name: "Forbidden" })).response.status, 403);
  await db.membership.update({ where: { userId_tenantId: { userId: owner.id, tenantId } }, data: { role: "owner", status: "disabled" } });
  assert.equal((await request("me")).response.status, 401);
  await db.membership.update({ where: { userId_tenantId: { userId: owner.id, tenantId } }, data: { status: "active" } });
  await db.user.update({ where: { id: owner.id }, data: { status: "disabled" } }); assert.equal((await request("me")).response.status, 401);
  await db.user.update({ where: { id: owner.id }, data: { status: "active" } });
  await db.userApiKey.update({ where: { id: key.id }, data: { expiresAt: new Date(0) } }); assert.equal((await request("me", "GET", undefined, { secret: generated.secret })).response.status, 401);
});
it("PostgreSQL: rotation overlap and replace preserve scopes and revoke immediately", async () => {
  const created = await createManagedKey({ tenantId, name: "Rotation", scopes: ["products:read"] }, currentUser);
  const overlap = await changeManagedKey(created.key.id, { tenantId, action: "rotate", mode: "overlap" }, currentUser);
  assert.ok("secret" in overlap); if (!("secret" in overlap)) throw new Error("Missing rotated secret");
  assert.equal((await request("me", "GET", undefined, { secret: created.secret })).response.status, 200);
  assert.equal((await request("me", "GET", undefined, { secret: overlap.secret })).response.status, 200);
  assert.ok(overlap.key);
  assert.deepEqual(overlap.key.scopes, ["products:read"]);
  const replaced = await changeManagedKey(overlap.key.id, { tenantId, action: "rotate", mode: "replace" }, currentUser); assert.ok("secret" in replaced);
  assert.equal((await request("me", "GET", undefined, { secret: overlap.secret })).response.status, 401);
  await changeManagedKey(created.key.id, { tenantId, action: "revoke" }, currentUser); assert.equal((await request("me", "GET", undefined, { secret: created.secret })).response.status, 401);
});
it("PostgreSQL: normal users manage only their own keys; administrators cannot rotate another owner's secret", async () => {
  await db.membership.create({ data: { userId: otherUser.id, tenantId, role: "viewer" } });
  const own = await createManagedKey({ tenantId, name: "Viewer", scopes: ["products:read"] }, async () => otherUser);
  const listed = await listManagement(tenantId, async () => otherUser); assert.ok(listed.keys.every(k => k.userId === otherUser.id));
  await assert.rejects(changeManagedKey(keyId, { tenantId, action: "revoke" }, async () => otherUser), { status: 404 });
  await assert.rejects(changeManagedKey(own.key.id, { tenantId, action: "rotate", mode: "replace" }, currentUser), { status: 403 });
  await assert.rejects(createManagedKey({ tenantId, name: "Escalation", scopes: ["payments:create"] }, async () => otherUser), { status: 403 });
});
it("PostgreSQL: ledger creation and posting enforce tenant accounts and locked periods", async () => {
  const r = await request("accounting/journal", "POST", { date: "2026-11-09", description: "API journal test", lines: [{ accountId, debit: "10", credit: "0" }, { accountId: expenseAccountId, debit: "0", credit: "10" }] });
  assert.equal(r.response.status, 201, JSON.stringify(r.json)); const entryId = String(r.data.id);
  const key = await createManagedKey({ tenantId, name: "Post and reverse", fullAccess: true }, currentUser);
  const call = (path: string, method = "GET", body?: unknown) => request(path, method, body, { secret: key.secret });
  const open = await call("accounting/journal", "POST", { date: "2026-10-09", description: "Open period", lines: [{ accountId, debit: "10", credit: "0" }, { accountId: expenseAccountId, debit: "0", credit: "10" }] }); assert.equal(open.response.status, 201);
  assert.equal((await call(`accounting/journal/${open.data.id}`)).response.status, 200);
  assert.equal((await call(`accounting/journal/${open.data.id}/post`, "POST", {})).response.status, 200);
  const reversal = await call(`accounting/journal/${open.data.id}/reverse`, "POST", { date: "2026-10-10" }); assert.equal(reversal.response.status, 200, JSON.stringify(reversal.json));
  await db.accountingPeriod.create({ data: { tenantId, year: 2026, month: 11, startDate: new Date("2026-11-01"), endDate: new Date("2026-12-01"), status: "LOCKED" } });
  const blocked = await request(`accounting/journal/${entryId}/post`, "POST", {}); assert.equal(blocked.response.status, 422, JSON.stringify(blocked.json));
  assert.equal((await db.accountingJournalEntry.findUniqueOrThrow({ where: { id: entryId } })).status, "DRAFT");
});
it("PostgreSQL: purchase creation uses service and creates only manual documents", async () => {
  const result = await request("purchases", "POST", { documentType: "INVOICE", supplierName: "Test supplier", issueDate: "2026-11-09", subtotal0: 10, total: 10, items: [{ productId, description: "Service", quantity: 1, unitPrice: 10 }] });
  assert.equal(result.response.status, 201, JSON.stringify(result.json)); assert.equal((await db.purchaseDocument.findUniqueOrThrow({ where: { id: String(result.data.id) } })).origin, "MANUAL");
  assert.equal((await request("purchases", "POST", { origin: "SRI_SYNC", total: 10 })).response.status, 400);
  const key = await createManagedKey({ tenantId, name: "Cancel purchase", fullAccess: true }, currentUser);
  const category = await db.purchaseAccountingCategory.create({ data: { tenantId, name: "Test purchase category" } });
  const edited = await request(`purchases/${result.data.id}`, "PATCH", { accountingCategoryId: category.id }, { secret: key.secret }); assert.equal(edited.response.status, 200, JSON.stringify(edited.json));
  const canceled = await request(`purchases/${result.data.id}/cancel`, "POST", {}, { secret: key.secret }); assert.equal(canceled.response.status, 200, JSON.stringify(canceled.json));
  assert.equal((await db.purchaseDocument.findUniqueOrThrow({ where: { id: String(result.data.id) } })).status, "CANCELLED");
});
it("PostgreSQL: rate limiter is atomic under concurrent connections", async () => {
  const generated = generateApiKey(); const key = await db.userApiKey.create({ data: { tenantId, userId: owner.id, name: "Rate", keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, scopes: ["products:read"] } });
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => rateLimit(key.id, "test-window", 5)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 5); assert.equal(results.filter(r => r.status === "rejected").length, 7);
  await assert.rejects(rateLimit(key.id, "requests", 0), { status: 429 });
  await db.apiRateWindow.updateMany({ where: { apiKeyId: key.id, bucket: "requests" }, data: { count: 120 } });
  const response = await request("products", "GET", undefined, { secret: generated.secret });
  assert.equal(response.response.status, 429); assert.equal(response.response.headers.get("Retry-After"), "60");
});
it("PostgreSQL: HTTP audit stores templates and identifiers without authentication or query secrets", async () => {
  await request("products?q=secret-query");
  const logs = await db.apiRequestLog.findMany({ where: { apiKeyId: keyId } }); assert.ok(logs.length > 10);
  const serialized = JSON.stringify(logs); assert.ok(!serialized.includes(secret)); assert.ok(!serialized.includes("secret-query")); assert.ok(logs.every(l => l.tenantId === tenantId && l.userId === owner.id));
  assert.ok((await db.userApiKey.findUniqueOrThrow({ where: { id: keyId } })).lastUsedAt);
});
it("PostgreSQL: in-flight idempotency is durable and cannot be reused after an interruption", async () => {
  const key = `interrupted-${runId}`, claim = await claimIdempotency(keyId, key, "POST sales", { amount: 10 }); assert.ok(!claim.replay);
  await assert.rejects(claimIdempotency(keyId, key, "POST sales", { amount: 10 }), { code: "IDEMPOTENCY_IN_PROGRESS" });
  await assert.rejects(claimIdempotency(keyId, key, "POST sales", { amount: 11 }), { code: "IDEMPOTENCY_CONFLICT" });
  await finishIdempotency(claim.id, { body: { ok: true, data: { id: "done" } }, status: 201 });
  assert.equal((await claimIdempotency(keyId, key, "POST sales", { amount: 10 })).replay?.status, 201);
});
it("management HTTP rejects API-key administration and cross-site writes", async () => {
  const action = async () => ({ bad: true });
  const apiRequest = new Request("http://localhost/api/settings/api-keys", { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal((await managementHttp(apiRequest, action)).status, 403);
  assert.equal((await managementHttp(new Request(apiRequest.url, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" }), action)).status, 403);
});
it("public API has no administrative routes or secret-bearing projections", async () => {
  assert.ok(!API_ROUTES.some(r => /billing|signature|credential|api.keys|admin/.test(r.path)));
  const result = await request(`sri/documents/${documentId}`); assert.equal(result.response.status, 200);
  assert.ok(!JSON.stringify(result.json).includes("StorageKey"));
  const invalid = await authenticateApiKey(new Request("http://localhost/api/v1/me", { headers: { Authorization: `Bearer ${generateApiKey().secret}` } })).then(() => false, () => true); assert.equal(invalid, true);
});
