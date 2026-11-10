import assert from "node:assert/strict";
import { test } from "node:test";
import { API_SCOPES, authorizedScopes, selectScopes } from "./catalog";
import { hasPermission } from "@/lib/auth/permissions";
import { generateApiKey, validApiKey, matchesHash, canonical } from "./crypto";
import { authenticateApiKey, requireScopes, type AuthStore, type KeyWithOwner } from "./auth";
import { rejectAuthority, pagination, date } from "./errors";
import { publicPayload } from "./serialization";
import { API_ROUTES, matchRoute } from "./routes";
import { openApiDocument } from "./openapi";
import type { AppsoluxUser } from "@/types/user";
const user: AppsoluxUser = { id: "user", name: "Integration tester", email: "test@example.com", role: "owner", tenant: null };
function fixture() {
  const generated = generateApiKey();
  const key: KeyWithOwner = { id: "key", userId: "user", tenantId: "company-a", name: "Test", keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, fullAccess: true, catalogVersion: 1, scopes: API_SCOPES.map(s => s.id), status: "ACTIVE", createdAt: new Date(), updatedAt: new Date(), expiresAt: null, lastUsedAt: null, revokedAt: null, revokedById: null, replacesKeyId: null, user: { id: "user", name: "Test", email: "test@example.com", status: "active" }, tenant: { id: "company-a", name: "A", slug: "a", status: "active" } };
  const db: AuthStore = { findKey: async hash => hash === key.keyHash ? key : null, findMembership: async () => ({ role: "owner", status: "active" }) };
  const request = new Request("https://facturom.com/api/v1/me", { headers: { Authorization: `Bearer ${generated.secret}` } });
  return { generated, key, db, request };
}
test("256-bit secrets are unique, well formed and verified in constant time", () => {
  const keys = Array.from({ length: 100 }, generateApiKey);
  assert.equal(new Set(keys.map(k => k.secret)).size, 100);
  for (const k of keys) { assert.ok(validApiKey(k.secret)); assert.ok(matchesHash(k.secret, k.keyHash)); assert.ok(!matchesHash(`${k.secret}x`, k.keyHash)); assert.equal(k.secret.split("_")[2].length, 64); assert.ok(!JSON.stringify({ keyHash: k.keyHash, keyPrefix: k.keyPrefix }).includes(k.secret)); }
});
test("Full Access resolves every current authorized scope; individual changes become custom", () => {
  const available = authorizedScopes(user, hasPermission), full = selectScopes({ fullAccess: true, scopes: ["invented"] }, available);
  assert.equal(full.scopes.length, API_SCOPES.length); assert.equal(full.fullAccess, true);
  assert.equal(selectScopes({ scopes: full.scopes.slice(1) }, available).fullAccess, false);
  assert.equal(selectScopes({ scopes: full.scopes }, available).fullAccess, true);
  assert.throws(() => selectScopes({ scopes: ["admin:billing"] }, available));
});
test("roles cannot request scopes above their effective permissions", () => {
  const viewer = authorizedScopes({ ...user, role: "viewer" }, hasPermission);
  assert.throws(() => selectScopes({ scopes: ["payments:create"] }, viewer));
  assert.ok(!viewer.some(s => s.id === "journal:create"));
  assert.ok(!authorizedScopes({ ...user, role: "seller" }, hasPermission).some(s => s.id === "users:read"));
});
test("valid Bearer key resolves the key's tenant and effective scopes without cookies", async () => {
  const f = fixture(), actor = await authenticateApiKey(f.request, f.db);
  assert.equal(actor.tenant.id, "company-a"); requireScopes(actor, ["products:create", "payments:create"]);
});
test("X-API-Key works; conflicting authentication headers fail", async () => {
  const f = fixture();
  await authenticateApiKey(new Request(f.request.url, { headers: { "X-API-Key": f.generated.secret } }), f.db);
  await assert.rejects(authenticateApiKey(new Request(f.request.url, { headers: { Authorization: `Bearer ${f.generated.secret}`, "X-API-Key": "different" } }), f.db), { status: 401 });
});
for (const state of ["missing", "unknown", "revoked", "expired", "disabled-user", "disabled-membership", "missing-membership", "disabled-tenant"] as const) test(`reject ${state}`, async () => {
  const f = fixture();
  if (state === "revoked") { f.key.status = "REVOKED"; f.key.revokedAt = new Date(); }
  if (state === "expired") f.key.expiresAt = new Date(0);
  if (state === "disabled-user") f.key.user.status = "disabled";
  if (state === "disabled-membership") f.db.findMembership = async () => ({ role: "owner", status: "disabled" });
  if (state === "missing-membership") f.db.findMembership = async () => null;
  if (state === "disabled-tenant") f.key.tenant.status = "suspended";
  if (state === "unknown") f.db.findKey = async () => null;
  await assert.rejects(authenticateApiKey(state === "missing" ? new Request(f.request.url) : f.request, f.db), { status: 401 });
});
test("Full Access flag never adds omitted, new or unauthorized scopes", async () => {
  const f = fixture(); f.key.scopes = ["products:read", "future:sensitive"];
  const actor = await authenticateApiKey(f.request, f.db);
  assert.deepEqual(actor.scopes, ["products:read"]); assert.throws(() => requireScopes(actor, ["products:create"]), { status: 403 });
  f.key.scopes = ["products:create", "products:read"];
  f.db.findMembership = async () => ({ role: "viewer", status: "active" });
  const reduced = await authenticateApiKey(f.request, f.db); assert.deepEqual(reduced.scopes, ["products:read"]);
});
test("reject tenant and owner overrides recursively", () => {
  for (const payload of [{ tenantId: "b" }, { items: [{ tenant_id: "b" }] }, { createdByUserId: "other" }, { payload: { fullAccess: true } }]) assert.throws(() => rejectAuthority(payload), { code: "AUTHORITY_OVERRIDE" });
  assert.doesNotThrow(() => rejectAuthority({ productId: "p", quantity: 2 }));
});
test("bounded pagination and canonical idempotency payloads", () => {
  for (const q of ["page=-1", "page=NaN", "pageSize=101", "pageSize=1.5", "page=1000000000"]) assert.throws(() => pagination(new URLSearchParams(q)));
  assert.equal(canonical({ b: 2, a: [1, 2] }), canonical({ a: [1, 2], b: 2 }));
  assert.notEqual(canonical([1, 2]), canonical([2, 1]));
});
test("registry, OpenAPI and scopes agree; static routes win over IDs", () => {
  assert.equal(matchRoute("GET", "sales/orders")?.route.path, "sales/orders");
  const routes = API_ROUTES.map(r => `${r.method}:${r.path}`); assert.equal(new Set(routes).size, routes.length);
  const openapi = openApiDocument();
  for (const r of API_ROUTES) { assert.ok(openapi.paths[`/${r.path}`]?.[r.method.toLowerCase()]); for (const s of r.scopes) assert.ok(API_SCOPES.some(d => d.id === s)); }
  for (const s of API_SCOPES) assert.ok(API_ROUTES.some(r => r.scopes.includes(s.id) || s.id === "prices:manage"), `No route for ${s.id}`);
  assert.equal(matchRoute("GET", "admin/billing"), null);
});

test("internal service results never expose storage keys or secret fields", () => {
  assert.deepEqual(publicPayload({ accessKey: "PUBLIC_TAX_KEY", imageStorageKey: "/private/path", encryptedPassword: "hidden", nested: [{ certificateBytes: "hidden", id: "visible" }] }), { accessKey: "PUBLIC_TAX_KEY", nested: [{ id: "visible" }] });
});

test("ISO dates reject impossible days and ambiguous local timestamps", () => {
  for (const value of ["2026-02-30", "2026-11-09T10:00:00", "invalid"]) assert.throws(() => date(value));
  assert.equal(date("2026-11-09").toISOString(), "2026-11-09T05:00:00.000Z");
});
