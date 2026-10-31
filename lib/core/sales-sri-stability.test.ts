import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import type { SalesSriSyncJob, PurchaseSriCredential, SalesAutoSyncSettings } from "@prisma/client";
import { salesCredentialLabel, salesSessionLabel, salesJobIssue, type SyncJobView } from "./sri-sync-presentation";
import { readFileSync } from "node:fs";

process.env.SRI_PURCHASE_CREDENTIAL_MASTER_KEY = Buffer.alloc(32, 5).toString("base64");
const now = new Date();
function makeJob(data: Partial<SalesSriSyncJob> = {}): SalesSriSyncJob {
  return { id: "historical-a", tenantId: "tenant-a", type: "SYNC_ISSUED_DOCUMENTS", status: "FAILED", requestedByUserId: "user-a", dateFrom: new Date("2026-01-01T05:00:00Z"), dateTo: new Date("2026-10-31T05:00:00Z"), checkpointDate: new Date("2026-01-27T05:00:00Z"), totalDays: 304, completedDays: 27, currentDateLabel: "2026-01-28", attemptCount: 3, maxAttempts: 3, lockedAt: null, lockedBy: null, startedAt: new Date("2026-10-31T08:00:00Z"), finishedAt: new Date("2026-10-31T09:00:00Z"), durationMs: 1000, documentsFound: 3, documentsImported: 0, documentsSkipped: 0, documentsRejected: 0, documentsFailed: 3, errorCode: "INTERNAL_IMPORT_FAILED", errorMessage: "SRI_DOWNLOAD_FAILED: Document not authorized: status=RECHAZADA", counterBaseline: null, attemptHistory: [], createdAt: new Date("2026-10-31T08:00:00Z"), updatedAt: now, ...data };
}
const configured: SalesAutoSyncSettings = { id: "settings-a", tenantId: "tenant-a", enabled: true, sriEnabled: true, apiEnabled: false, syncFrequency: "DAILY", lastSyncAt: null, lastSuccessAt: null, nextSyncAt: null, lastError: "No se pudo confirmar login exitoso — la estructura del portal puede haber cambiado.", createdAt: now, updatedAt: now };
let jobs: SalesSriSyncJob[] = []; let credentials: PurchaseSriCredential[] = []; let settings = { ...configured };
let credentialWrites = 0; let purchaseVerifications = 0; let locks = 0; let transactionQueue = Promise.resolve();
type Where = { id?: string; tenantId?: string; type?: string; status?: string | { in: string[] } };
const matches = (row: SalesSriSyncJob, where: Where) => (!where.id || row.id === where.id) && (!where.tenantId || row.tenantId === where.tenantId) && (!where.type || row.type === where.type) && (!where.status || (typeof where.status === "string" ? row.status === where.status : where.status.in.includes(row.status)));
const database = {
  $transaction: async <T>(action: (tx: unknown) => Promise<T>): Promise<T> => {
    const previous = transactionQueue; let unlock!: () => void;
    transactionQueue = new Promise<void>((resolve) => { unlock = resolve; });
    await previous; try { return await action(database); } finally { unlock(); }
  },
  $executeRaw: async () => { locks++; return 0; },
  purchaseSriCredential: {
    findUnique: async ({ where }: { where: { tenantId: string } }) => credentials.find((row) => row.tenantId === where.tenantId) ?? null,
    upsert: async ({ where, update }: { where: { tenantId: string }; update: Partial<PurchaseSriCredential> }) => { credentialWrites++; const row = credentials.find((row) => row.tenantId === where.tenantId)!; Object.assign(row, update); return row; },
  },
  salesAutoSyncSettings: {
    findUnique: async () => settings,
    update: async ({ data }: { data: Partial<SalesAutoSyncSettings> }) => Object.assign(settings, data),
    updateMany: async ({ data }: { data: Partial<SalesAutoSyncSettings> }) => { Object.assign(settings, data); return { count: 1 }; },
    upsert: async ({ update }: { update: Partial<SalesAutoSyncSettings> }) => Object.assign(settings, update),
  },
  salesSriSyncJob: {
    findFirst: async ({ where }: { where: Where }) => jobs.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where, orderBy }: { where: Where; orderBy?: { updatedAt?: string } }) => { const rows = jobs.filter((row) => matches(row, where)); return orderBy?.updatedAt ? rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()) : rows; },
    count: async ({ where }: { where: Where }) => jobs.filter((row) => matches(row, where)).length,
    create: async ({ data }: { data: Partial<SalesSriSyncJob> }) => { const row = makeJob({ id: `new-${jobs.length}`, status: "QUEUED", checkpointDate: null, completedDays: 0, ...data }); jobs.unshift(row); return row; },
    update: async ({ where, data }: { where: Where; data: Partial<SalesSriSyncJob> }) => { const row = jobs.find((row) => matches(row, where))!; assert.ok(row, "tenant-scoped job update"); Object.assign(row, data); return row; },
  },
  purchaseSriSyncJob: {
    findFirst: async () => null,
    create: async () => { purchaseVerifications++; return { id: "purchase-verification", status: "QUEUED" }; },
  },
};
let adapter: typeof import("./sales-sync-adapter");
let api: typeof import("../../app/api/sales-import/auto-sync/route");
let jobsApi: typeof import("../../app/api/sales-import/sync-jobs/route");
let credentialApi: typeof import("../../app/api/purchases/sri-credentials/route");
let credentialService: typeof import("./purchase-sri-credentials");
let view: typeof import("../../components/appsolux/sri-tax/sales-automatic-sync-view");
let cards: typeof import("../../components/appsolux/sri-tax/sync-progress-card");
test.before(async () => {
  mock.module(resolve("lib/security/server-only.ts"), { namedExports: {} });
  mock.module(resolve("lib/db/prisma.ts"), { namedExports: { getPrismaClient: () => database } });
  mock.module(resolve("lib/core/require-dashboard-session.ts"), { namedExports: { requireDashboardSession: async () => ({ user: { id: "user-a" }, tenant: { id: "tenant-a" } }) } });
  mock.module(resolve("lib/auth/current-user.ts"), { namedExports: { getCurrentUser: async () => ({ id: "user-a" }) } });
  mock.module(resolve("lib/tenant/current-tenant.ts"), { namedExports: { getCurrentTenant: async () => ({ id: "tenant-a" }) } });
  mock.module(resolve("lib/core/tenant-features.ts"), { namedExports: { resolveEffectiveTenantAccessForTenant: async () => ({ features: [] }), featureEnabled: () => true } });
  adapter = await import("./sales-sync-adapter"); api = await import("../../app/api/sales-import/auto-sync/route"); jobsApi = await import("../../app/api/sales-import/sync-jobs/route");
  credentialApi = await import("../../app/api/purchases/sri-credentials/route"); credentialService = await import("./purchase-sri-credentials");
  view = await import("../../components/appsolux/sri-tax/sales-automatic-sync-view"); cards = await import("../../components/appsolux/sri-tax/sync-progress-card");
});
test.beforeEach(() => {
  jobs = []; settings = { ...configured }; credentialWrites = 0; purchaseVerifications = 0; locks = 0;
  const encrypted = credentialService.encryptSriPassword("fixture-password");
  credentials = [{ id: "credential-a", tenantId: "tenant-a", username: "fixture-ruc", additionalUserId: null, encryptedPassword: encrypted.encryptedPassword, encryptionIv: encrypted.iv, authTag: encrypted.authTag, keyVersion: encrypted.keyVersion, status: "VERIFIED", verifiedAt: now, lastVerificationAt: now, lastVerificationError: null, createdAt: now, updatedAt: now }];
});
const request = (body: Record<string, unknown>) => new Request("http://localhost/api/sales-import/auto-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const credentialRequest = (body: Record<string, unknown>) => new NextRequest("http://localhost/api/purchases/sri-credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const jobView = (job: SalesSriSyncJob): SyncJobView => JSON.parse(JSON.stringify({ ...job, resumable: adapter.canResumeSalesJob(job) }));

test("manual action resumes the same historical job from Jan 28, preserves 27/304 and archives obsolete error", async () => {
  const original = makeJob(); jobs = [original];
  const response = await api.POST(request({ action: "manual_sync", tenantId: "tenant-b" })); const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.resumed, true); assert.equal(data.job.id, original.id); assert.equal(jobs.length, 1);
  assert.equal(data.job.checkpointDate, "2026-01-27T05:00:00.000Z"); assert.equal(data.job.completedDays, 27); assert.equal(data.job.totalDays, 304);
  assert.equal(data.job.dateTo, "2026-10-31T05:00:00.000Z"); assert.equal(data.job.errorMessage, null); assert.equal(settings.lastError, null);
  assert.match(JSON.stringify(data.job.attemptHistory), /RECHAZADA/); assert.equal(credentialWrites, 0);
});

test("two concurrent clicks and a scheduler call cannot create duplicate active jobs for the tenant", async () => {
  const results = await Promise.all([api.POST(request({ action: "manual_sync" })), api.POST(request({ action: "manual_sync" })), adapter.createScheduledSyncJob("tenant-a", "DAILY")]);
  assert.equal(jobs.length, 1); assert.equal(jobs[0]!.status, "QUEUED"); assert.equal(locks, 3);
  for (const response of results.slice(0, 2) as Response[]) assert.equal((await response.json()).jobId, jobs[0]!.id);
});

test("after a completed historical job the next run is incremental from the processed period, not Jan 1", async () => {
  jobs = [makeJob({ status: "SUCCEEDED", checkpointDate: new Date("2026-10-31T05:00:00Z"), completedDays: 304, errorCode: null, errorMessage: null })];
  settings.lastSuccessAt = new Date("2026-11-03T05:00:00Z");
  const data = await (await api.POST(request({ action: "manual_sync" }))).json();
  assert.equal(data.resumed, false); assert.equal(data.job.dateFrom, "2026-10-30T05:00:00.000Z");
});

test("only stale RUNNING jobs can be recovered and another tenant's job is never exposed or resumed", async () => {
  jobs = [makeJob({ status: "RUNNING", updatedAt: new Date() }), makeJob({ id: "job-b", tenantId: "tenant-b" })];
  assert.equal(adapter.canResumeSalesJob(jobs[0]!), false);
  let result = await (await api.POST(request({ action: "resume_sync", jobId: "historical-a" }))).json(); assert.equal(result.resumed, false);
  assert.equal((await api.POST(request({ action: "resume_sync", jobId: "job-b" }))).status, 404);
  jobs[0]!.updatedAt = new Date(Date.now() - adapter.SALES_JOB_STALE_MS - 1000);
  result = await (await api.POST(request({ action: "resume_sync", jobId: "historical-a" }))).json(); assert.equal(result.resumed, true);
  const listing = await (await jobsApi.GET(new NextRequest("http://localhost/api/sales-import/sync-jobs?tenantId=tenant-b"))).json();
  assert.ok(listing.jobs.every((row: { tenantId?: string; id: string }) => row.id !== "job-b"));
});

test("unchanged credentials retain ciphertext, verification dates and status and do not enqueue verification", async () => {
  const original = { ...credentials[0]! };
  const response = await credentialApi.POST(credentialRequest({ username: "fixture-ruc", password: "fixture-password", verificationTarget: "sales", tenantId: "tenant-b" }));
  const data = await response.json(); assert.equal(data.unchanged, true); assert.equal(data.status, "VERIFIED");
  assert.deepEqual(credentials[0], original); assert.equal(credentialWrites, 0); assert.equal(jobs.length, 0); assert.equal(purchaseVerifications, 0);
  await credentialService.upsertCredential("tenant-a", "fixture-ruc", "fixture-password"); assert.equal(credentialWrites, 0);
});

test("changed credentials are encrypted and initially verified by sales; existing purchases caller retains its own path", async () => {
  const response = await credentialApi.POST(credentialRequest({ username: "fixture-ruc", password: "changed-fixture-password", verificationTarget: "sales" }));
  assert.equal(response.status, 200); assert.equal(jobs[0]!.type, "VERIFY_CONNECTION"); assert.equal(purchaseVerifications, 0);
  assert.equal(credentials[0]!.status, "PENDING_VERIFICATION"); assert.equal(credentials[0]!.verifiedAt, null);
  assert.notEqual(credentials[0]!.encryptedPassword, "changed-fixture-password");
  await credentialApi.POST(credentialRequest({ username: "fixture-ruc", password: "another-fixture-password" }));
  assert.equal(purchaseVerifications, 1); assert.equal(jobs.length, 1);
});

test("reload and progress/config GET are read-only: they neither reverify nor expose stored secrets", async () => {
  jobs = [makeJob()];
  for (let i = 0; i < 3; i++) {
    const data = await (await api.GET()).json();
    const publicView = await (await credentialApi.GET()).json();
    await jobsApi.GET(new NextRequest("http://localhost/api/sales-import/sync-jobs"));
    for (const text of [JSON.stringify(data), JSON.stringify(publicView)]) for (const secret of ["encryptedPassword", "authTag", "fixture-password", credentials[0]!.encryptedPassword]) assert.ok(!text.includes(secret));
  }
  assert.equal(credentialWrites, 0); assert.equal(purchaseVerifications, 0); assert.equal(jobs.length, 1);
});

test("sales UI separates credentials, session and latest result; no obsolete config error is repeated", () => {
  const current = jobView(makeJob({ status: "RUNNING", documentsRejected: 3, documentsFailed: 0, errorCode: null, errorMessage: null }));
  const html = renderToStaticMarkup(createElement(view.SalesAutomaticSyncView, { credential: { configured: true, status: "VERIFIED", verifiedAt: now.toISOString() }, config: { ...settings, nextSyncAt: settings.nextSyncAt?.toISOString() ?? null }, job: current, latestJob: current, busy: false, loading: false, error: null, onSync() {}, onToggle() {}, onFrequency() {} }));
  for (const text of ["Importación automática de ventas", "Sincronizar ahora", "Configuración SRI", "Ver historial", "9%", "27 de 304", "Rechazados / omitidos", "Errores técnicos", "Credenciales configuradas"]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes(configured.lastError!)); assert.ok(!html.includes("Credenciales inválidas"));
  assert.ok(html.includes('href="/facturacion/configuration?tab=sri"')); assert.ok(html.includes('href="/facturacion/sales/imports/sync-history"'));
  assert.equal(salesCredentialLabel({ configured: true, status: "VERIFIED" }), "Credenciales configuradas");
  assert.equal(salesSessionLabel(jobView(makeJob({ errorCode: "SRI_QUERY_FAILED" }))), "Sesión o consulta con dificultades");
});

test("resume button is singular, latest success survives reload, and technical codes stay inside details", () => {
  const pending = jobView(makeJob({ documentsRejected: 3, documentsFailed: 0 }));
  let html = renderToStaticMarkup(createElement(view.SalesAutomaticSyncView, { credential: { configured: true, status: "VERIFIED" }, config: { ...settings, nextSyncAt: settings.nextSyncAt?.toISOString() ?? null }, job: pending, latestJob: pending, busy: false, loading: false, error: null, onSync() {}, onToggle() {}, onFrequency() {} }));
  assert.equal((html.match(/Reanudar sincronización/g) ?? []).length, 1); assert.ok(!html.includes(">Sincronizar ahora<"));
  assert.match(html, /<details[^>]*>[\s\S]*?Ver detalles[\s\S]*?INTERNAL_IMPORT_FAILED/);
  const success = JSON.parse(JSON.stringify(jobView(makeJob({ status: "SUCCEEDED", errorCode: null, errorMessage: null, checkpointDate: new Date("2026-10-31T05:00:00Z"), completedDays: 304 }))));
  html = renderToStaticMarkup(createElement(cards.SalesSyncProgressCard, { job: success, compact: true }));
  assert.ok(html.includes("100%")); assert.ok(html.includes("Completado")); assert.ok(!html.includes("INTERNAL_IMPORT_FAILED"));
  assert.ok(!renderToStaticMarkup(createElement(cards.SyncProgressCard, { job: pending, title: "Compras" })).includes("Rechazados / omitidos"));
  assert.match(salesJobIssue(jobView(makeJob({ errorCode: "SRI_QUERY_FAILED" })))!, /consulta/);
});

test("migration is additive and does not alter purchases, existing documents or checkpoints", () => {
  const sql = readFileSync("prisma/migrations/20261031700000_sales_sri_document_outcomes/migration.sql", "utf8");
  assert.match(sql, /documentsRejected/); assert.match(sql, /SalesSriSyncDocument/);
  assert.match(sql, /one_running_per_tenant[\s\S]*?WHERE status = 'RUNNING'/);
  assert.doesNotMatch(sql, /^\s*(?:DROP |TRUNCATE |DELETE FROM|UPDATE "Purchase|UPDATE "ExternalSalesDocument|SET "checkpointDate")/im);
});


test("an omitted additional-user field preserves the configured identity when saving the same password", async () => {
  credentials[0]!.additionalUserId = "fixture-additional-user";
  const result = await (await credentialApi.POST(credentialRequest({ username: "fixture-ruc", password: "fixture-password", verificationTarget: "sales" }))).json();
  assert.equal(result.unchanged, true); assert.equal(credentials[0]!.additionalUserId, "fixture-additional-user");
  assert.equal(credentialWrites, 0); assert.equal(jobs.length, 0);
});

test("an interrupted verification can be replaced without invalidating credentials or blocking future sales work", async () => {
  jobs = [makeJob({ type: "VERIFY_CONNECTION", status: "RUNNING", updatedAt: new Date(Date.now() - adapter.SALES_JOB_STALE_MS - 1) })];
  const result = await (await api.POST(request({ action: "verify_connection" }))).json();
  assert.equal(result.created, true); assert.equal(jobs.length, 2);
  assert.equal(jobs.find((job) => job.id === "historical-a")!.status, "FAILED");
  assert.equal(credentials[0]!.status, "VERIFIED"); assert.equal(credentialWrites, 0);
});


test("a resumed older job that succeeds is displayed ahead of newer-created obsolete failures", async () => {
  jobs = [makeJob({ id: "obsolete-failure", updatedAt: new Date("2026-10-30T10:00:00Z") }), makeJob({ id: "older-created-success", status: "SUCCEEDED", updatedAt: new Date(), errorCode: null, errorMessage: null, completedDays: 304, checkpointDate: new Date("2026-10-31T05:00:00Z") })];
  const data = await (await jobsApi.GET(new NextRequest("http://localhost/api/sales-import/sync-jobs"))).json();
  assert.equal(data.jobs[0].id, "older-created-success"); assert.equal(data.resumeJob, null);
  assert.equal(data.jobs[0].errorMessage, null);
});
