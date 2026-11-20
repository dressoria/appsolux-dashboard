import assert from "node:assert/strict";
import { resolve } from "node:path";
import test, { mock } from "node:test";
import { normalizeCustomerInternalCode, isCustomerInternalCodeConflict } from "./customer-internal-code";

type Row = Record<string, unknown> & { id: string; tenantId: string };
let rows: Row[] = [];
let authenticated = true;
let simulateCodeRace = false;
const matches = (row: Row, where: Record<string, unknown>): boolean => Object.entries(where).every(([key, value]) => {
  if (value && typeof value === "object" && "not" in value) return row[key] !== value.not;
  return row[key] === value;
});
const db = {
  lightweightCustomer: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where)),
    count: async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      if (simulateCodeRace) throw { code: "P2002", meta: { target: ["tenantId", "internalCode"] } };
      const row: Row = { ...data, id: `customer-${rows.length}`, tenantId: String(data.tenantId) };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = rows.find((candidate) => matches(candidate, where));
      assert.ok(row);
      Object.assign(row, data);
      return row;
    },
  },
  membership: { findFirst: async () => null },
};

let core: typeof import("./lightweight-pos");
let createApi: typeof import("../../app/api/basic/customers/route");
let updateApi: typeof import("../../app/api/basic/customers/[customerId]/route");

test.before(async () => {
  mock.module(resolve("lib/security/server-only.ts"), { namedExports: {} });
  mock.module(resolve("lib/db/prisma.ts"), { namedExports: { getPrismaClient: () => db } });
  mock.module(resolve("lib/core/tenant-operational-access.ts"), { namedExports: { requireTenantOperationalAccess: async () => undefined } });
  mock.module(resolve("lib/core/plans.ts"), { namedExports: { getLimit: async () => 100 } });
  mock.module(resolve("lib/auth/current-user.ts"), { namedExports: { getCurrentUser: async () => authenticated ? { id: "user-test" } : null } });
  mock.module(resolve("lib/tenant/current-tenant.ts"), { namedExports: { getCurrentTenant: async () => ({ id: "tenant-authorized" }) } });
  core = await import("./lightweight-pos");
  createApi = await import("../../app/api/basic/customers/route");
  updateApi = await import("../../app/api/basic/customers/[customerId]/route");
});

test.beforeEach(() => { rows = []; authenticated = true; simulateCodeRace = false; });
const request = (body: Record<string, unknown>, method = "POST") => new Request("http://localhost/api/basic/customers", {
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("name-only creation keeps fiscal data empty and defaults active", async () => {
  const response = await createApi.POST(request({ name: "  Cliente mínimo  " }));
  assert.equal(response.status, 200);
  const { customer } = await response.json();
  assert.equal(customer.name, "Cliente mínimo");
  assert.equal(customer.isActive, true);
  assert.equal(customer.identification, null);
  assert.equal(customer.identificationType, undefined);
  assert.equal(customer.internalCode, null);
  assert.equal(customer.phone, undefined);
});

for (const isActive of [true, false]) test(`optional quick fields reach persistence with isActive=${isActive}`, async () => {
  const response = await createApi.POST(request({
    name: "Cliente", phone: "+593 99 123 4567", address: " Calle 1 ",
    internalCode: " 0007 ", isActive, notes: " Solo para el equipo ", tenantId: "forged-tenant",
  }));
  assert.equal(response.status, 200);
  const { customer } = await response.json();
  assert.equal(customer.tenantId, "tenant-authorized");
  assert.equal(customer.internalCode, "0007");
  assert.equal(customer.phone, "+593 99 123 4567");
  assert.equal(customer.address, "Calle 1");
  assert.equal(customer.notes, "Solo para el equipo");
  assert.equal(customer.isActive, isActive);
  const readBack = await core.listCustomers("tenant-authorized");
  assert.equal(readBack[0].notes, customer.notes);
});

test("complete creation preserves fiscal data, multiple contacts and commercial fields", async () => {
  const response = await createApi.POST(request({
    name: "Cliente completo", identificationType: "RUC", identification: "1790016919001",
    tradeName: "Comercial", emails: ["CLIENTE@example.com", "otro@example.com"],
    phone: "0991234567", phoneNumbers: ["+1 (212) 555-0100"],
    country: "Ecuador", province: "PICHINCHA", city: "QUITO", parish: "IÑAQUITO",
    customerType: "Mayorista", customerOrigin: "NATIONAL", sector: "Centro", zone: "Norte", groupName: "VIP",
    notes: "Nota interna completa", internalCode: "CLI-001", isActive: false,
  }));
  assert.equal(response.status, 200);
  const { customer } = await response.json();
  assert.equal(customer.identification, "1790016919001");
  assert.equal(customer.identificationType, "RUC");
  assert.equal(customer.email, "cliente@example.com");
  assert.deepEqual(customer.additionalEmails, ["otro@example.com"]);
  assert.deepEqual(customer.phoneNumbers, ["+1 (212) 555-0100"]);
  assert.equal(customer.customerType, "Mayorista");
  assert.equal(customer.parish, "IÑAQUITO");
  assert.equal(customer.notes, "Nota interna completa");
  assert.equal(customer.isActive, false);
});

test("internal codes are unique within a tenant and reusable across tenants", async () => {
  await core.createCustomer({ tenantId: "tenant-authorized", name: "Uno", internalCode: "001" });
  await assert.rejects(core.createCustomer({ tenantId: "tenant-authorized", name: "Dos", internalCode: " 001 " }), /código interno/);
  await core.createCustomer({ tenantId: "other-tenant", name: "Otro", internalCode: "001" });
  assert.equal(rows.length, 2);
  const ownCustomers = await core.listCustomers("tenant-authorized");
  assert.equal(ownCustomers.length, 1);
});

test("blank optional codes allow multiple minimal customers", async () => {
  await core.createCustomer({ tenantId: "tenant-authorized", name: "Uno", internalCode: " " });
  await core.createCustomer({ tenantId: "tenant-authorized", name: "Dos" });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.internalCode === null));
});

test("PATCH retains omitted data and persists active status, code and notes", async () => {
  const customer = await core.createCustomer({ tenantId: "tenant-authorized", name: "Uno", internalCode: "A", phone: "0991234567" });
  const context = { params: Promise.resolve({ customerId: customer.id }) };
  const response = await updateApi.PATCH(request({ notes: "Nota editada", isActive: false, internalCode: "B" }, "PATCH"), context);
  assert.equal(response.status, 200);
  assert.equal(rows[0].phone, "0991234567");
  assert.equal(rows[0].name, "Uno");
  assert.equal(rows[0].notes, "Nota editada");
  assert.equal(rows[0].isActive, false);
  assert.equal(rows[0].internalCode, "B");
  await updateApi.PATCH(request({ internalCode: "", notes: "", isActive: true }, "PATCH"), context);
  assert.equal(rows[0].internalCode, null);
  assert.equal(rows[0].notes, null);
  assert.equal(rows[0].isActive, true);
});

test("editing the same code is allowed; assigning another customer's code fails", async () => {
  const a = await core.createCustomer({ tenantId: "tenant-authorized", name: "A", internalCode: "A" });
  const b = await core.createCustomer({ tenantId: "tenant-authorized", name: "B", internalCode: "B" });
  await core.updateCustomer({ tenantId: "tenant-authorized", customerId: a.id, internalCode: "A" });
  await assert.rejects(core.updateCustomer({ tenantId: "tenant-authorized", customerId: b.id, internalCode: "A" }), /código interno/);
});

test("tenant injection cannot edit another company's customer or link it", async () => {
  const other = await core.createCustomer({ tenantId: "other-tenant", name: "Ajeno" });
  const response = await updateApi.PATCH(request({ name: "Ataque", tenantId: "other-tenant" }, "PATCH"), { params: Promise.resolve({ customerId: other.id }) });
  assert.equal(response.status, 400);
  assert.equal(rows[0].name, "Ajeno");
  for (const field of ["relatedCustomerId", "invoiceThirdPartyCustomerId", "assignedSellerId"]) {
    const result = await createApi.POST(request({ name: "Ataque", [field]: other.id }));
    assert.equal(result.status, 400);
  }
  assert.equal(rows.length, 1);
});

test("API requires authentication before creating or updating", async () => {
  authenticated = false;
  assert.equal((await createApi.POST(request({ name: "Ataque" }))).status, 401);
  assert.equal((await updateApi.PATCH(request({ name: "Ataque" }, "PATCH"), { params: Promise.resolve({ customerId: "other" }) })).status, 401);
  assert.equal(rows.length, 0);
});

test("server rejects empty names, overlong codes, bad IDs and duplicate contacts", async () => {
  for (const body of [
    { name: " " }, { name: "Uno", internalCode: "x".repeat(101) },
    { name: "Uno", identificationType: "RUC", identification: "123" },
    { name: "Uno", emails: ["bad-email"] },
    { name: "Uno", phone: "0991234567", phoneNumbers: ["0991234567"] },
  ]) assert.equal((await createApi.POST(request(body))).status, 400);
  assert.equal(rows.length, 0);
});

test("unique-index races return a readable conflict without Prisma details", async () => {
  simulateCodeRace = true;
  const response = await createApi.POST(request({ name: "Uno", internalCode: "RACE" }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /código interno/);
  assert.equal(isCustomerInternalCodeConflict({ code: "P2002", meta: { target: ["tenantId", "identification"] } }), false);
  assert.equal(normalizeCustomerInternalCode(" 0001 "), "0001");
});
