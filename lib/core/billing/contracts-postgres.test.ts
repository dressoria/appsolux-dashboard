import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import { Webhooks, NodeRuntime } from "@paddle/paddle-node-sdk";
import { getPrismaClient } from "@/lib/db/prisma";
import { createCheckoutIntent, syncPaddleSubscription, buildPaddleSubscriptionSnapshot } from "./paddle-billing";
import { receivePaddleEvent, processPaddleInbox } from "./paddle-inbox";
import { createBankTransferRequest, approveBankTransfer, rejectBankTransfer } from "./bank-transfer-service";
import { legalDocuments } from "@/lib/legal/catalog";
import { prepareLegalDraft, approveLegalDraft, publishLegalRelease, legalReviewAreas } from "@/lib/legal/publication";
import { currentLegalRelease, publicLegalBundle, assertContractOwner, contentHash, validateLegalProof } from "@/lib/legal/service";
import { bootstrapAuthenticatedUserTenant } from "@/lib/onboarding/bootstrap-authenticated-user";

const url = process.env.FACTUROM_BILLING_TEST_DATABASE_URL;
const it = (name: string, fn: () => Promise<void>) => test(name, { skip: !url }, fn);
const run = randomUUID().slice(0, 8);
let db: ReturnType<typeof getPrismaClient>;
let adminId: string;
let release: Awaited<ReturnType<typeof prepareLegalDraft>>;
let proof: { accepted: boolean; authorizedRepresentative: boolean; releaseId: string; releaseHash: string };
async function company(interval: "MONTHLY" | "YEARLY" = "MONTHLY") {
  const id = randomUUID();
  const user = await db.user.create({ data: { name: "Local test owner", email: `${id}@example.invalid`, status: "active" } });
  const tenant = await db.tenant.create({ data: { name: "Local test company", slug: id, status: "active", planKey: "free" } });
  await db.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "owner", status: "active" } });
  const plan = await db.plan.findUniqueOrThrow({ where: { key: "free" } });
  const sub = await db.tenantSubscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "active", billingMode: "internal" } });
  const intent = await createCheckoutIntent({ tenantId: tenant.id, userId: user.id, planCode: "ENTERPRISE", billingInterval: interval, legalProof: proof });
  return { user, tenant, sub, intent, interval };
}
type Company = Awaited<ReturnType<typeof company>>;
function event(c: Company, input: { id?: string; subId?: string; status?: string; occurredAt?: Date; price?: string; token?: string; createdAt?: Date; cancel?: boolean; period?: boolean } = {}) {
  const time = input.occurredAt ?? new Date(Date.now() + 1000);
  return { eventId: input.id ?? `evt_${randomUUID()}`, eventType: `subscription.${input.status === "canceled" ? "canceled" : input.status === "past_due" ? "past_due" : input.status === "paused" ? "paused" : "updated"}`, occurredAt: time.toISOString(), data: { id: input.subId ?? `sub_${c.tenant.id}`, customerId: `ctm_${c.tenant.id}`, status: input.status ?? "active", createdAt: (input.createdAt ?? new Date(Date.now() + 10)).toISOString(), items: [{ price: { id: input.price ?? `pri_enterprise_${c.interval.toLowerCase()}` }, quantity: 1 }], currentBillingPeriod: input.period === false ? null : { startsAt: "2026-11-10T10:30:00Z", endsAt: c.interval === "YEARLY" ? "2027-11-10T10:30:00Z" : "2026-12-10T10:30:00Z" }, scheduledChange: input.cancel ? { action: "cancel" } : null, customData: { cid: input.token ?? c.intent.token } } };
}
async function apply(e: ReturnType<typeof event>) {
  await receivePaddleEvent(e);
  const result = await processPaddleInbox(25);
  return result;
}
async function state(c: Company) { return db.tenantSubscription.findUniqueOrThrow({ where: { id: c.sub.id } }); }
async function transfer(c: Company, interval: "MONTHLY" | "YEARLY" = c.interval) {
  return createBankTransferRequest({ tenantId: c.tenant.id, requestedById: c.user.id, planCode: "ENTERPRISE", billingInterval: interval, bankReference: randomUUID(), receiptFileId: "synthetic-local-test", receiptFileName: "synthetic.pdf", receiptFileType: "application/pdf", receiptFileSizeBytes: 100, legalProof: proof });
}

before(async () => {
  if (!url) return;
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) throw new Error("Explicit local *_test database required.");
  process.env.DATABASE_URL = url; process.env.PADDLE_ENV = "sandbox";
  for (const plan of ["BASIC", "BUSINESS", "ENTERPRISE"]) for (const interval of ["MONTHLY", "YEARLY"]) process.env[`PADDLE_PRICE_${plan}_${interval}`] = `pri_${plan.toLowerCase()}_${interval.toLowerCase()}`;
  Object.assign(process.env, { LEGAL_OPERATOR_NAME: "SYNTHETIC TEST OPERATOR", LEGAL_OPERATOR_RUC: "0000000000000", LEGAL_OPERATOR_DOMICILE: "LOCAL TEST ONLY", LEGAL_OPERATOR_COUNTRY: "Ecuador", LEGAL_SUPPORT_EMAIL: "support@example.invalid", LEGAL_PRIVACY_EMAIL: "privacy@example.invalid", LEGAL_NOTICES_EMAIL: "legal@example.invalid", LEGAL_EFFECTIVE_DATE: "2026-01-01", LEGAL_DPO_APPLICABILITY: "not-required-reviewed" });
  db = getPrismaClient();
  for (const key of ["free", "pro", "enterprise", "trial"]) await db.plan.upsert({ where: { key }, update: {}, create: { key, name: key, limits: {}, features: {} } });
  const admin = await db.user.create({ data: { name: "Local reviewer", email: `review-${run}@example.invalid`, status: "active" } }); adminId = admin.id;
  process.env.BILLING_REVIEW_ADMIN_EMAILS = admin.email;
  const contents = Object.fromEntries(legalDocuments.map((d) => [d.type, `${d.title}\nSynthetic test contract only, never a public legal draft. Run ${run}`]));
  release = await prepareLegalDraft({ version: `test-${run}`, contents, effectiveAt: new Date("2026-01-01") });
  proof = { accepted: true, authorizedRepresentative: true, releaseId: release.id, releaseHash: release.hash };
});
after(async () => { if (db) await db.$disconnect(); });

it("Legal: unpublished draft cannot be accepted or published without lawyer review", async () => {
  await assert.rejects(validateLegalProof(db, proof));
  await assert.rejects(publishLegalRelease(release.id, release.hash), /aprobación explícita/);
  await assert.rejects(approveLegalDraft(release.id, release.hash, "", {}), /revisión jurídica/);
});
it("Legal: sealed approval and explicit publication expose exact five versions and hashes", async () => {
  await approveLegalDraft(release.id, release.hash, "SYNTHETIC LOCAL REVIEW ONLY", Object.fromEntries(legalReviewAreas.map((key) => [key, true])));
  await publishLegalRelease(release.id, release.hash);
  const bundle = await publicLegalBundle(); assert.equal(bundle.id, release.id); assert.equal(bundle.documents.length, 5);
  const current = await currentLegalRelease(); for (const doc of current.documents) assert.equal(doc.hash, contentHash(doc.content));
});
it("Legal: required acceptance, representation and exact version cannot be forged", async () => {
  await assert.rejects(validateLegalProof(db, undefined), /Acepta expresamente/);
  for (const bad of [{ ...proof, accepted: false }, { ...proof, authorizedRepresentative: false }, { ...proof, releaseHash: "forged" }, { ...proof, releaseId: "forged" }]) await assert.rejects(validateLegalProof(db, bad));
});
it("Legal: reviewed contents and publication cannot be modified or deleted in PostgreSQL", async () => {
  const doc = release.documents[0];
  await assert.rejects(db.legalDocumentVersion.update({ where: { id: doc.id }, data: { content: "altered" } }));
  await assert.rejects(db.legalDocumentVersion.delete({ where: { id: doc.id } }));
  await assert.rejects(db.legalRelease.update({ where: { id: release.id }, data: { hash: "altered" } }));
});
it("Legal: operation-bound immutable evidence belongs to authenticated owner and own tenant", async () => {
  const c = await company(); const other = await company();
  const evidence = await db.legalAcceptance.findUniqueOrThrow({ where: { operationReference: `paddle:${c.intent.intentId}` }, include: { release: { include: { documents: true } } } });
  assert.equal(evidence.tenantId, c.tenant.id); assert.equal(evidence.userId, c.user.id); assert.equal(evidence.releaseHash, release.hash); assert.equal(evidence.release.documents.length, 5);
  assert.equal((evidence.documents as Array<{ action: string }>).filter((d) => d.action === "ACKNOWLEDGED").length, 2);
  await assert.rejects(db.legalAcceptance.update({ where: { id: evidence.id }, data: { acceptedAt: new Date(0) } }));
  await assert.rejects(assertContractOwner(db, c.user.id, other.tenant.id), /propietario activo/);
});
it("Legal: onboarding without acceptance rolls back tenant/trial, existing active subscription is unaffected", async () => {
  const user = await db.user.create({ data: { name: "New local", email: `${randomUUID()}@example.invalid`, status: "active" } });
  await assert.rejects(bootstrapAuthenticatedUserTenant({ userId: user.id, email: user.email, name: user.name, companyName: "No contract", taxIdentificationType: "none" }));
  assert.equal(await db.membership.count({ where: { userId: user.id } }), 0);
  const c = await company(); assert.equal((await state(c)).status, "active");
});
it("Legal: valid onboarding links trial and acceptance atomically", async () => {
  const user = await db.user.create({ data: { name: "New local", email: `${randomUUID()}@example.invalid`, status: "active" } });
  const result = await bootstrapAuthenticatedUserTenant({ userId: user.id, email: user.email, name: user.name, companyName: "Accepted local", taxIdentificationType: "none", legalProof: proof });
  assert.equal(await db.legalAcceptance.count({ where: { tenantId: result.tenantId, userId: user.id, context: "ONBOARDING" } }), 1);
  assert.equal((await db.tenantSubscription.findFirstOrThrow({ where: { tenantId: result.tenantId } })).status, "trialing");
});
it("Paddle: direct intent creation without acceptance or foreign membership is rejected", async () => {
  const c = await company(); const other = await company();
  await assert.rejects(createCheckoutIntent({ tenantId: c.tenant.id, userId: c.user.id, planCode: "BASIC", billingInterval: "MONTHLY" }));
  await assert.rejects(createCheckoutIntent({ tenantId: other.tenant.id, userId: c.user.id, planCode: "BASIC", billingInterval: "MONTHLY", legalProof: proof }));
});
it("Paddle SDK: valid RAW signature passes; wrong signature and altered body fail", async () => {
  const raw = JSON.stringify({ event_id: `evt_${run}`, event_type: "transaction.completed", occurred_at: new Date().toISOString(), data: { id: "txn_local", status: "completed", items: [], payments: [] } });
  const secret = "synthetic-local-endpoint-secret"; const ts = Math.floor(Date.now() / 1000);
  const signature = `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")}`;
  NodeRuntime.initialize();
  const sdk = new Webhooks(); assert.equal(await sdk.isSignatureValid(raw, secret, signature), true);
  assert.equal(await sdk.isSignatureValid(raw + " ", secret, signature), false);
  assert.equal(await sdk.isSignatureValid(raw, "wrong", signature), false);
});
for (const interval of ["MONTHLY", "YEARLY"] as const) it(`Paddle PostgreSQL: ${interval} active internal transitions to correct paid mode and plan`, async () => {
  const c = await company(interval); const e = event(c); await apply(e);
  const sub = await state(c); assert.equal(sub.status, "active"); assert.equal(sub.billingMode, "paddle"); assert.equal(sub.billingInterval, interval); assert.equal(sub.providerPriceId, `pri_enterprise_${interval.toLowerCase()}`);
  assert.equal((await db.tenant.findUniqueOrThrow({ where: { id: c.tenant.id } })).planKey, "enterprise");
  const intent = await db.paddleCheckoutIntent.findUniqueOrThrow({ where: { id: c.intent.intentId } }); assert.equal(intent.status, "completed"); assert.ok(intent.completedAt);
});
it("Paddle PostgreSQL: receipt is durable before processing, duplicates/concurrent processors activate once", async () => {
  const c = await company(); const e = event(c);
  assert.equal((await receivePaddleEvent(e)).duplicate, false); assert.equal((await state(c)).billingMode, "internal");
  assert.equal((await receivePaddleEvent(e)).duplicate, true);
  await Promise.all([processPaddleInbox(25), processPaddleInbox(25)]);
  assert.equal(await db.billingWebhookEvent.count({ where: { externalEventId: e.eventId } }), 1);
  assert.equal(await db.auditLog.count({ where: { tenantId: c.tenant.id, action: "subscription_activated" } }), 1);
});
it("Paddle PostgreSQL: delayed legitimate purchase uses signed creation time, expired arbitrary purchase fails", async () => {
  const c = await company();
  await db.paddleCheckoutIntent.update({ where: { id: c.intent.intentId }, data: { createdAt: new Date("2026-01-01"), expiresAt: new Date("2026-01-01T02:00:00Z") } });
  await apply(event(c, { createdAt: new Date("2026-01-01T01:00:00Z") })); assert.equal((await state(c)).billingMode, "paddle");
  const bad = await company(); await db.paddleCheckoutIntent.update({ where: { id: bad.intent.intentId }, data: { expiresAt: new Date(0) } });
  await apply(event(bad)); assert.equal((await state(bad)).billingMode, "internal");
});
it("Paddle PostgreSQL: wrong price, unknown cid and wrong environment never activate", async () => {
  const c = await company(); await apply(event(c, { price: "pri_basic_yearly" })); assert.equal((await state(c)).billingMode, "internal");
  const unknown = await company(); await apply(event(unknown, { token: "arbitrary" })); assert.equal((await state(unknown)).billingMode, "internal");
  const snapshot = buildPaddleSubscriptionSnapshot(event(c).data, new Date().toISOString());
  await assert.rejects(syncPaddleSubscription({ snapshot: { ...snapshot, environment: "production" } }), /ENVIRONMENT_MISMATCH/);
});
it("Paddle PostgreSQL: provider subscription cannot bind another tenant or a second intent", async () => {
  const a = await company(); const b = await company(); await apply(event(a));
  await apply(event(b, { subId: `sub_${a.tenant.id}` })); assert.equal((await state(b)).billingMode, "internal");
  await apply(event(a, { subId: "sub_second" })); assert.equal((await state(a)).providerSubscriptionId, `sub_${a.tenant.id}`);
});
it("Paddle PostgreSQL: transaction.completed confirms payment without granting access", async () => {
  const c = await company(); await receivePaddleEvent({ eventId: `evt_${randomUUID()}`, eventType: "transaction.completed", occurredAt: new Date().toISOString(), data: { id: `txn_${run}`, status: "completed", subscriptionId: `sub_${c.tenant.id}`, customerId: `ctm_${c.tenant.id}`, items: [{ price: { id: "pri_enterprise_monthly" }, quantity: 1 }], customData: { cid: c.intent.token } } }); await processPaddleInbox(25);
  assert.ok((await db.paddleCheckoutIntent.findUniqueOrThrow({ where: { id: c.intent.intentId } })).paymentConfirmedAt); assert.equal((await state(c)).billingMode, "internal");
});
it("Paddle PostgreSQL: cancellation ordering, scheduled cancel, failed payment and reactivation", async () => {
  const c = await company(); const t = Date.now() + 10_000;
  await apply(event(c, { occurredAt: new Date(t), cancel: true })); assert.equal((await state(c)).cancelAtPeriodEnd, true); assert.equal((await state(c)).status, "active");
  await apply(event(c, { occurredAt: new Date(t + 1000), status: "past_due" })); assert.equal((await state(c)).status, "past_due"); assert.ok((await state(c)).graceEndsAt);
  await apply(event(c, { occurredAt: new Date(t + 2000), status: "paused", period: false })); assert.equal((await state(c)).status, "suspended");
  await apply(event(c, { occurredAt: new Date(t + 3000) })); assert.equal((await state(c)).status, "active"); assert.equal((await state(c)).graceEndsAt, null);
  await apply(event(c, { occurredAt: new Date(t + 5000), status: "canceled", period: false })); assert.equal((await state(c)).status, "canceled");
  await apply(event(c, { occurredAt: new Date(t + 4000) })); assert.equal((await state(c)).status, "canceled");
});
it("Paddle PostgreSQL: failed processing preserves record/history and safe retry", async () => {
  const c = await company(); const e = event(c);
  await db.$executeRawUnsafe(`CREATE FUNCTION fail_contract_test_${run}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER fail_contract_test_${run} BEFORE UPDATE ON "Tenant" FOR EACH ROW WHEN (OLD.id = '${c.tenant.id}') EXECUTE FUNCTION fail_contract_test_${run}()`);
  await apply(e); assert.equal((await state(c)).billingMode, "internal");
  const failed = await db.billingWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: e.eventId } } }); assert.equal(failed.status, "failed");
  await db.$executeRawUnsafe(`DROP TRIGGER fail_contract_test_${run} ON "Tenant"`); await db.$executeRawUnsafe(`DROP FUNCTION fail_contract_test_${run}()`);
  await db.billingWebhookEvent.update({ where: { id: failed.id }, data: { nextAttemptAt: new Date(0) } }); await processPaddleInbox(25);
  assert.equal((await state(c)).billingMode, "paddle"); assert.equal((await db.billingWebhookEvent.findUniqueOrThrow({ where: { id: failed.id } })).status, "processed");
  assert.equal(await db.billingWebhookAttempt.count({ where: { eventId: failed.id } }), 2);
});
it("Bank PostgreSQL: acceptance required before request; duplicate requests are atomically prevented", async () => {
  const c = await company(); const initial = await transfer(c);
  await assert.rejects(createBankTransferRequest({ ...initial, requestedById: c.user.id, planCode: "ENTERPRISE", billingInterval: "MONTHLY", receiptFileId: "local", receiptFileName: "local.pdf", receiptFileType: "application/pdf", receiptFileSizeBytes: 20, bankReference: randomUUID(), legalProof: undefined }));
  await assert.rejects(transfer(c), /pendiente de revisión/);
});
for (const interval of ["MONTHLY", "YEARLY"] as const) it(`Bank PostgreSQL: ${interval} approval is atomic and repeat/concurrent approval creates one invoice`, async () => {
  const c = await company(interval); const request = await transfer(c);
  const approvals = await Promise.all([approveBankTransfer({ requestId: request.id, adminUserId: adminId }), approveBankTransfer({ requestId: request.id, adminUserId: adminId })]);
  assert.equal(approvals[0].subscription.id, approvals[1].subscription.id); assert.equal(approvals[0].period.endsAt.toISOString(), approvals[1].period.endsAt.toISOString());
  assert.equal((await state(c)).billingMode, "manual"); assert.equal((await state(c)).billingInterval, interval);
  assert.equal((await db.bankTransferRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "APPROVED");
  assert.equal(await db.commercialInvoicePending.count({ where: { bankTransferRequestId: request.id } }), 1);
  assert.equal(await db.auditLog.count({ where: { entityId: request.id, action: "commercial_invoice.pending" } }), 1);
  assert.equal(await db.auditLog.count({ where: { entityId: request.id, action: "bank_transfer.approved" } }), 1);
});
it("Bank PostgreSQL: rollback after invoice failure leaves no activated plan, persists incident, retry keeps historical audits", async () => {
  const c = await company(); const request = await transfer(c);
  await db.auditLog.createMany({ data: [1, 2].map(() => ({ tenantId: c.tenant.id, action: "commercial_invoice.pending", entityType: "BankTransferRequest", entityId: request.id })) });
  await db.$executeRawUnsafe(`CREATE FUNCTION fail_invoice_test_${run}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic invoice failure'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER fail_invoice_test_${run} BEFORE INSERT ON "CommercialInvoicePending" FOR EACH ROW WHEN (NEW."bankTransferRequestId" = '${request.id}') EXECUTE FUNCTION fail_invoice_test_${run}()`);
  await assert.rejects(approveBankTransfer({ requestId: request.id, adminUserId: adminId }));
  assert.equal((await state(c)).billingMode, "internal"); assert.equal((await db.tenant.findUniqueOrThrow({ where: { id: c.tenant.id } })).planKey, "free");
  assert.equal((await db.bankTransferRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "ACTIVATION_FAILED");
  assert.equal(await db.auditLog.count({ where: { entityId: request.id, action: "bank_transfer.approved" } }), 0);
  await db.$executeRawUnsafe(`DROP TRIGGER fail_invoice_test_${run} ON "CommercialInvoicePending"`); await db.$executeRawUnsafe(`DROP FUNCTION fail_invoice_test_${run}()`);
  await approveBankTransfer({ requestId: request.id, adminUserId: adminId });
  assert.equal(await db.auditLog.count({ where: { entityId: request.id, action: "commercial_invoice.pending" } }), 2);
  assert.equal(await db.commercialInvoicePending.count({ where: { bankTransferRequestId: request.id } }), 1);
});
it("Bank PostgreSQL: reviewer permission, self approval and rejection controls", async () => {
  const c = await company(); const request = await transfer(c);
  await assert.rejects(approveBankTransfer({ requestId: request.id, adminUserId: c.user.id }), /Administrador/);
  await db.membership.create({ data: { userId: adminId, tenantId: c.tenant.id, role: "viewer", status: "active" } });
  await assert.rejects(approveBankTransfer({ requestId: request.id, adminUserId: adminId }), /propia empresa/);
  await assert.rejects(rejectBankTransfer({ requestId: request.id, adminUserId: adminId, adminNote: "synthetic" }), /propia empresa/);
  const other = await company(); const r = await transfer(other); await rejectBankTransfer({ requestId: r.id, adminUserId: adminId, adminNote: "Synthetic unmatched receipt" });
  assert.equal((await db.bankTransferRequest.findUniqueOrThrow({ where: { id: r.id } })).status, "REJECTED"); assert.equal((await state(other)).billingMode, "internal");
});
it("Bank PostgreSQL: renewal preserves paid period and former provider event cannot overwrite manual activation", async () => {
  const c = await company(); await apply(event(c)); await apply(event(c, { occurredAt: new Date(Date.now() + 5000), status: "canceled", period: false }));
  const first = await transfer(c); const a = await approveBankTransfer({ requestId: first.id, adminUserId: adminId });
  const second = await transfer(c, "YEARLY"); const b = await approveBankTransfer({ requestId: second.id, adminUserId: adminId });
  assert.equal(b.period.startsAt.getTime(), a.period.endsAt.getTime()); assert.equal(b.period.endsAt.getUTCFullYear(), a.period.endsAt.getUTCFullYear() + 1);
  await apply(event(c, { occurredAt: new Date(Date.now() + 10000) })); assert.equal((await state(c)).billingMode, "manual");
});
it("Paddle PostgreSQL: a plan change requires current contractual evidence and binds the accepted price", async () => {
  const c = await company(); await apply(event(c));
  const unauthorized = event(c, { price: "pri_business_yearly", occurredAt: new Date(Date.now() + 5000) });
  await apply(unauthorized); assert.equal((await state(c)).providerPriceId, "pri_enterprise_monthly");
  const change = await createCheckoutIntent({ tenantId: c.tenant.id, userId: c.user.id, planCode: "BUSINESS", billingInterval: "YEARLY", legalProof: proof, operation: "change" });
  await apply(event(c, { price: "pri_business_yearly", occurredAt: new Date(Date.now() + 6000) }));
  assert.equal((await state(c)).providerPriceId, "pri_business_yearly"); assert.equal((await state(c)).billingInterval, "YEARLY");
  assert.equal((await db.paddleCheckoutIntent.findUniqueOrThrow({ where: { id: change.intentId } })).status, "completed");
});
it("Paddle PostgreSQL: active state with missing period or incompatible provider interval is held for review", async () => {
  const c = await company(); await apply(event(c, { period: false })); assert.equal((await state(c)).billingMode, "internal");
  const e = event(c); await receivePaddleEvent({ ...e, data: { ...e.data, billingCycle: { interval: "year", frequency: 1 } } }); await processPaddleInbox(25); assert.equal((await state(c)).billingMode, "internal");
});
it("Paddle PostgreSQL: expired worker lease can recover without deleting the event", async () => {
  const c = await company(); const e = event(c); await receivePaddleEvent(e);
  const row = await db.billingWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: e.eventId } } });
  await db.billingWebhookEvent.update({ where: { id: row.id }, data: { status: "processing", lockedAt: new Date(0), lockToken: "crashed-worker", attempts: 1 } });
  await processPaddleInbox(25); assert.equal((await state(c)).billingMode, "paddle"); assert.equal((await db.billingWebhookEvent.findUniqueOrThrow({ where: { id: row.id } })).attempts, 2);
});
it("Bank PostgreSQL: simultaneous requests cannot create two pending transfers", async () => {
  const c = await company(); const results = await Promise.allSettled([transfer(c), transfer(c)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(await db.bankTransferRequest.count({ where: { tenantId: c.tenant.id } }), 1);
});
it("Bank PostgreSQL: a billable Paddle subscription blocks approval and preserves review state", async () => {
  const c = await company(); await apply(event(c)); const request = await transfer(c);
  await assert.rejects(approveBankTransfer({ requestId: request.id, adminUserId: adminId }), /Paddle activa/);
  const retained = await db.bankTransferRequest.findUniqueOrThrow({ where: { id: request.id } }); assert.equal(retained.status, "PENDING_REVIEW"); assert.equal(retained.activationErrorCode, "PADDLE_STILL_BILLABLE");
  assert.equal((await state(c)).billingMode, "paddle"); assert.equal(await db.commercialInvoicePending.count({ where: { bankTransferRequestId: request.id } }), 0);
});
it("Legal: missing operator identity blocks approval and technical evidence is separate and expirable", async () => {
  const contents = Object.fromEntries(legalDocuments.map((d) => [d.type, `${d.title} SYNTHETIC SECOND REVIEW ${run}`]));
  const draft = await prepareLegalDraft({ version: `draft-${run}`, contents, effectiveAt: new Date("2026-01-01") });
  const ruc = process.env.LEGAL_OPERATOR_RUC; delete process.env.LEGAL_OPERATOR_RUC;
  await assert.rejects(approveLegalDraft(draft.id, draft.hash, "local review", Object.fromEntries(legalReviewAreas.map((key) => [key, true]))), /incompleta/);
  process.env.LEGAL_OPERATOR_RUC = ruc;
  const c = await company(); process.env.LEGAL_TECHNICAL_RETENTION_DAYS = "2"; process.env.LEGAL_IP_HASH_SECRET = "synthetic-test-only-secret";
  const intent = await createCheckoutIntent({ tenantId: c.tenant.id, userId: c.user.id, planCode: "BASIC", billingInterval: "YEARLY", legalProof: proof, technicalEvidence: { ip: "127.0.0.1", userAgent: "Synthetic local browser" } });
  const data = await db.paddleCheckoutIntent.findUniqueOrThrow({ where: { id: intent.intentId }, include: { legalAcceptance: { include: { technicalEvidence: true } } } });
  assert.ok(data.legalAcceptance?.technicalEvidence?.ipDigest); assert.notEqual(data.legalAcceptance?.technicalEvidence?.ipDigest, "127.0.0.1");
  await db.legalAcceptanceTechnicalEvidence.delete({ where: { acceptanceId: data.legalAcceptanceId! } }); assert.ok(await db.legalAcceptance.findUnique({ where: { id: data.legalAcceptanceId! } }));
  delete process.env.LEGAL_TECHNICAL_RETENTION_DAYS; delete process.env.LEGAL_IP_HASH_SECRET;
});
it("Paddle PostgreSQL: canceling a known subscription still revokes access when its price is unrecognized", async () => {
  const c = await company(); await apply(event(c));
  await apply(event(c, { status: "canceled", price: "pri_retired_or_unaccepted", occurredAt: new Date(Date.now() + 7000), period: false }));
  assert.equal((await state(c)).status, "canceled"); assert.equal((await state(c)).providerPriceId, "pri_enterprise_monthly");
});
it("Paddle PostgreSQL: an explicit retry preserves event ID and lifetime attempts after automatic exhaustion", async () => {
  const c = await company(); const e = event(c); await receivePaddleEvent(e);
  const row = await db.billingWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: e.eventId } } });
  await db.billingWebhookEvent.update({ where: { id: row.id }, data: { status: "failed", attempts: 12, nextAttemptAt: new Date(Date.now() + 86400000) } });
  await processPaddleInbox(1, { retryFailedEventId: e.eventId });
  const saved = await db.billingWebhookEvent.findUniqueOrThrow({ where: { id: row.id } }); assert.equal(saved.status, "processed"); assert.equal(saved.attempts, 13); assert.equal((await state(c)).billingMode, "paddle");
});
it("Legal PostgreSQL: trial failure after acceptance rolls back company, membership and evidence together", async () => {
  const user = await db.user.create({ data: { name: "Rollback local", email: `${randomUUID()}@example.invalid`, status: "active" } });
  const name = `Rollback trial ${run}`;
  await db.$executeRawUnsafe(`CREATE FUNCTION trial_rollback_${run}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM "Tenant" WHERE id = NEW."tenantId" AND name = '${name}') THEN RAISE EXCEPTION 'synthetic trial rollback'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER trial_rollback_${run} BEFORE INSERT ON "TenantSubscription" FOR EACH ROW EXECUTE FUNCTION trial_rollback_${run}()`);
  try { await assert.rejects(bootstrapAuthenticatedUserTenant({ userId: user.id, email: user.email, name: user.name, companyName: name, taxIdentificationType: "none", legalProof: proof })); }
  finally { await db.$executeRawUnsafe(`DROP TRIGGER trial_rollback_${run} ON "TenantSubscription"`); await db.$executeRawUnsafe(`DROP FUNCTION trial_rollback_${run}()`); }
  assert.equal(await db.legalAcceptance.count({ where: { userId: user.id } }), 0); assert.equal(await db.membership.count({ where: { userId: user.id } }), 0); assert.equal(await db.tenant.count({ where: { name } }), 0);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).trialConsumedAt, null);
});
it("Legal PostgreSQL: concurrent onboarding creates only one company, trial and acceptance", async () => {
  const user = await db.user.create({ data: { name: "Concurrent local", email: `${randomUUID()}@example.invalid`, status: "active" } });
  const input = { userId: user.id, email: user.email, name: user.name, companyName: `Concurrent ${run}`, taxIdentificationType: "none" as const, legalProof: proof };
  const results = await Promise.all([bootstrapAuthenticatedUserTenant(input), bootstrapAuthenticatedUserTenant(input)]);
  assert.equal(results[0].tenantId, results[1].tenantId);
  assert.equal(await db.membership.count({ where: { userId: user.id } }), 1);
  assert.equal(await db.legalAcceptance.count({ where: { userId: user.id, context: "ONBOARDING" } }), 1);
  assert.equal(await db.tenantSubscription.count({ where: { tenantId: results[0].tenantId } }), 1);
});
it("Paddle PostgreSQL: ambiguous historical provider IDs never bind or activate another tenant", async () => {
  const a = await company(); const b = await company();
  const providerSubscriptionId = `sub_ambiguous_${run}`;
  for (const c of [a, b]) await db.tenantSubscription.update({ where: { id: c.sub.id }, data: { billingMode: "paddle", providerSubscriptionId, providerCustomerId: `ctm_${a.tenant.id}` } });
  const e = event(a, { subId: providerSubscriptionId }); await apply(e);
  const row = await db.billingWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: e.eventId } } });
  assert.equal(row.errorMessage, "PADDLE_HISTORICAL_MAPPING_AMBIGUOUS"); assert.equal(await db.paddleSubscriptionLink.count({ where: { providerSubscriptionId } }), 0);
  assert.equal((await db.tenant.findUniqueOrThrow({ where: { id: b.tenant.id } })).planKey, "free");
});
