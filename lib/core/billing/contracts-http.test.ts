import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { isClerkIndependentRoute } from "@/lib/security/clerk-independent-routes";
import { legalDocuments } from "@/lib/legal/catalog";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ContractAcceptance } from "@/components/appsolux/legal/contract-acceptance";
const base = process.env.FACTUROM_BILLING_TEST_BASE_URL;
const testUrl = process.env.FACTUROM_BILLING_TEST_DATABASE_URL;
const it = (name: string, fn: () => Promise<void>) => test(name, { skip: !base || !testUrl }, fn);
let db: PrismaClient;
const secret = "synthetic-local-endpoint-secret";
const webhook = "/api/billing/webhooks/paddle";
async function post(body: string, signed = true) {
  const ts = Math.floor(Date.now() / 1000);
  return fetch(base + webhook, { method: "POST", redirect: "manual", headers: signed ? { "paddle-signature": `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}` } : {}, body });
}
before(() => {
  if (!base || !testUrl) return;
  if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname) || !["127.0.0.1", "localhost"].includes(new URL(testUrl).hostname) || !new URL(testUrl).pathname.endsWith("_test")) throw new Error("Local HTTP and database URLs required.");
  db = new PrismaClient({ datasourceUrl: testUrl });
});
after(async () => { if (db) await db.$disconnect(); });
test("Clerk: exact webhook and legal paths bypass auth; other billing endpoints remain protected", () => {
  assert.equal(isClerkIndependentRoute(webhook), true);
  for (const spec of legalDocuments) assert.equal(isClerkIndependentRoute(`/${spec.slug}`), true);
  for (const path of ["/api/billing/checkout", "/api/billing/portal", "/api/billing/status", "/api/billing/bank-transfer", `${webhook}/other`, "/api/legal/history"]) assert.equal(isClerkIndependentRoute(path), false);
});
test("Legal UI: acceptance is not prechecked and does not grant promotional consent", () => {
  const html = renderToStaticMarkup(createElement(ContractAcceptance));
  assert.doesNotMatch(html, /checked=""/); assert.match(html, /no autoriza publicidad/);
});
it("HTTP with Clerk enabled: missing signature and invalid signature reach handler, return 400 with no login redirect", async () => {
  const missing = await post("{}", false); assert.equal(missing.status, 400); assert.equal(missing.headers.get("location"), null);
  const bad = await fetch(base + webhook, { method: "POST", redirect: "manual", headers: { "paddle-signature": "ts=1;h1=invalid" }, body: "{}" });
  assert.equal(bad.status, 400); assert.equal(bad.headers.get("location"), null);
});
it("HTTP with Clerk enabled: valid signed subscription is durable, activates own tenant, duplicate never repeats activation", async () => {
  const key = randomUUID(); const t = new Date().toISOString();
  const plan = await db.plan.findUniqueOrThrow({ where: { key: "free" } });
  const user = await db.user.create({ data: { name: "Synthetic HTTP owner", email: `${key}@example.invalid`, status: "active" } });
  const tenant = await db.tenant.create({ data: { name: "Synthetic HTTP tenant", slug: key, status: "active", planKey: "free" } });
  await db.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "owner", status: "active" } });
  const sub = await db.tenantSubscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "active", billingMode: "internal" } });
  const intent = await db.paddleCheckoutIntent.create({ data: { tenantId: tenant.id, userId: user.id, token: randomUUID(), planCode: "ENTERPRISE", billingInterval: "MONTHLY", expectedPriceId: "pri_enterprise_monthly", environment: "sandbox", expiresAt: new Date(Date.now() + 3600000) } });
  const eventId = `evt_local_http_${key}`;
  const body = JSON.stringify({ event_id: eventId, notification_id: `ntf_local_${key}`, event_type: "subscription.activated", occurred_at: new Date().toISOString(), data: { id: `sub_local_${key}`, customer_id: `ctm_local_${key}`, address_id: "add_local_test", status: "active", created_at: new Date().toISOString(), updated_at: t, currency_code: "USD", collection_mode: "automatic", billing_cycle: { interval: "month", frequency: 1 }, items: [{ status: "active", quantity: 1, recurring: true, created_at: t, updated_at: t, price: { id: "pri_enterprise_monthly", product_id: "pro_local", description: "Local synthetic test", billing_cycle: { interval: "month", frequency: 1 }, unit_price: { amount: "5999", currency_code: "USD" } } }], current_billing_period: { starts_at: "2026-11-10T00:00:00Z", ends_at: "2026-12-10T00:00:00Z" }, custom_data: { cid: intent.token } } });
  const received = await post(body); assert.equal(received.status, 200); assert.equal(received.headers.get("location"), null);
  const row = await db.billingWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: eventId } } }); assert.ok(row.payload); assert.doesNotMatch(JSON.stringify(row.payload), new RegExp(intent.token));
  const duplicate = await post(body); assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).duplicate, true);
  // Poll the actual asynchronous server processor, never trigger a new checkout.
  let current = await db.tenantSubscription.findUniqueOrThrow({ where: { id: sub.id } });
  for (let attempt = 0; attempt < 20 && current.billingMode !== "paddle"; attempt++) { await new Promise((resolve) => setTimeout(resolve, 100)); current = await db.tenantSubscription.findUniqueOrThrow({ where: { id: sub.id } }); }
  assert.equal(current.billingMode, "paddle"); assert.equal(current.providerPriceId, "pri_enterprise_monthly");
  assert.equal(await db.auditLog.count({ where: { tenantId: tenant.id, action: "subscription_activated" } }), 1);
});
it("HTTP: public historical legal documents are available without session; unknown draft never leaks", async () => {
  const release = await db.legalRelease.findFirstOrThrow({ where: { status: "PUBLISHED" }, include: { documents: true } });
  for (const spec of legalDocuments) {
    const doc = release.documents.find((d) => d.type === spec.type)!;
    const response = await fetch(`${base}/${spec.slug}?version=${encodeURIComponent(doc.version)}`, { redirect: "manual" });
    assert.equal(response.status, 200); assert.equal(response.headers.get("location"), null); const text = await response.text(); assert.ok(text.includes(doc.hash));
  }
  const response = await fetch(`${base}/terminos-y-condiciones?version=not-published`); assert.match(await response.text(), /no está publicada/);
});
it("HTTP: cron processor fails closed with no configured secret", async () => {
  const response = await fetch(base + "/api/cron/billing/paddle", { method: "POST", redirect: "manual" }); assert.equal(response.status, 503); assert.equal(response.headers.get("location"), null);
});
