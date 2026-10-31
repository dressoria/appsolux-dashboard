import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { selectVisibleSyncJob, syncPercentage, connectionLabel, type SyncJobView } from "./sri-sync-presentation";
import { SRI_SALES_NAVIGATION, SRI_PURCHASES_NAVIGATION } from "../../config/sri-tax-navigation";

const job = (status: string, overrides: Partial<SyncJobView> = {}): SyncJobView => ({ id: "latest-job", type: "SYNC_ISSUED_DOCUMENTS", status, dateFrom: "2026-10-17T05:00:00Z", dateTo: "2026-10-19T05:00:00Z", checkpointDate: null, totalDays: 3, completedDays: 1, currentDateLabel: "2026-10-18", documentsFound: 4, documentsImported: 2, documentsSkipped: 1, documentsFailed: 1, startedAt: "2026-10-31T10:00:00Z", finishedAt: "2026-10-31T10:05:00Z", errorCode: null, errorMessage: null, ...overrides });
let card: typeof import("../../components/appsolux/sri-tax/sync-progress-card");
let salesUI: typeof import("../../app/facturacion/sales/imports/sales-import-client");
let purchasesTabs: typeof import("../../components/appsolux/sri-tax/purchases-import-tabs");
let salesJobs: typeof import("../../app/api/sales-import/sync-jobs/route");
let salesAuto: typeof import("../../app/api/sales-import/auto-sync/route");
let purchaseJobs: typeof import("../../app/api/purchases/sri-sync/jobs/route");
let status: typeof import("./purchase-sync-jobs");
let createdTenant: string | undefined;
const importedRows: Record<string, unknown>[] = [];
const finishedJob = { ...job("FAILED", { errorCode: "SRI_QUERY_FAILED", errorMessage: "Consulta JSF rechazada por el portal" }), tenantId: "tenant-session", createdAt: new Date("2026-10-31T10:00:00Z") };
const credential = { tenantId: "tenant-session", username: "1791234567001", additionalUserId: null, status: "VERIFIED", encryptedPassword: "private-encrypted-fixture", encryptionIv: "private-iv", authTag: "private-tag", verifiedAt: new Date("2026-10-31T09:00:00Z"), lastVerificationAt: new Date("2026-10-31T09:00:00Z"), lastVerificationError: null };
const config = { tenantId: "tenant-session", enabled: true, sriEnabled: true, syncFrequency: "DAILY", lastSuccessAt: null };
const assertTenant = (args: { where: { tenantId: string } }) => assert.equal(args.where.tenantId, "tenant-session");
const database = {
  externalSalesDocument: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => importedRows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, id: `fixture-external-${importedRows.length}` }; importedRows.push(row); return { id: row.id }; },
  },
  sriDocument: { findFirst: async () => null },
  purchaseSriCredential: { findUnique: async (args: { where: { tenantId: string } }) => { assertTenant(args); return credential; } },
  salesAutoSyncSettings: { findUnique: async () => config, update: async () => config },
  salesSriSyncJob: {
    findMany: async (args: { where: { tenantId: string } }) => { assertTenant(args); return [finishedJob]; },
    count: async (args: { where: { tenantId: string } }) => { assertTenant(args); return 1; },
    findFirst: async (args: { where: { tenantId: string } }) => { assertTenant(args); return null; },
    create: async ({ data }: { data: { tenantId: string; dateFrom?: Date; dateTo?: Date; type: string } }) => { createdTenant = data.tenantId; return { ...job("QUEUED"), ...data, finishedAt: null }; },
  },
  purchaseSriSyncConfig: { findUnique: async () => ({ status: "ERROR", lastError: "SRI_QUERY_FAILED" }) },
  purchaseSriSyncJob: {
    findMany: async (args: { where: { tenantId: string } }) => { assertTenant(args); return [finishedJob]; },
    count: async (args: { where: { tenantId: string } }) => { assertTenant(args); return 1; },
    findFirst: async (args: { where: { tenantId: string; status?: unknown } }) => { assertTenant(args); return args.where.status ? null : finishedJob; },
  },
};

test.before(async () => {
  mock.module(resolve("lib/security/server-only.ts"), { namedExports: {} });
  mock.module(resolve("lib/db/prisma.ts"), { namedExports: { getPrismaClient: () => database } });
  mock.module(resolve("lib/core/require-dashboard-session.ts"), { namedExports: { requireDashboardSession: async () => ({ tenant: { id: "tenant-session" } }) } });
  mock.module(resolve("lib/auth/current-user.ts"), { namedExports: { getCurrentUser: async () => ({ id: "session-user" }) } });
  mock.module(resolve("lib/tenant/current-tenant.ts"), { namedExports: { getCurrentTenant: async () => ({ id: "tenant-session" }) } });
  mock.module(resolve("lib/core/tenant-features.ts"), { namedExports: { resolveEffectiveTenantAccessForTenant: async () => ({ features: [] }), featureEnabled: () => true } });
  card = await import("../../components/appsolux/sri-tax/sync-progress-card");
  salesUI = await import("../../app/facturacion/sales/imports/sales-import-client");
  purchasesTabs = await import("../../components/appsolux/sri-tax/purchases-import-tabs");
  salesJobs = await import("../../app/api/sales-import/sync-jobs/route");
  salesAuto = await import("../../app/api/sales-import/auto-sync/route");
  purchaseJobs = await import("../../app/api/purchases/sri-sync/jobs/route");
  status = await import("./purchase-sync-jobs");
});

test("last completed or failed job survives page reload; active work takes precedence", () => {
  for (const state of ["SUCCEEDED", "FAILED", "PARTIAL", "HUMAN_VERIFICATION_REQUIRED"]) {
    const previous = [job(state)];
    assert.equal(selectVisibleSyncJob(JSON.parse(JSON.stringify(previous)))?.status, state);
  }
  assert.equal(selectVisibleSyncJob([job("FAILED"), job("RUNNING", { id: "active" })])?.id, "active");
});

test("progress card renders actual counters, current date, finished time and actual error", () => {
  const html = renderToStaticMarkup(createElement(card.SyncProgressCard, { job: job("FAILED", { errorCode: "SRI_QUERY_FAILED", errorMessage: "Consulta JSF rechazada" }), title: "Último intento" }));
  for (const value of ["33%", "1 de 3", "2026-10-18", "Encontrados", "Importados", "Duplicados", "Errores", "Finalizado", "SRI_QUERY_FAILED", "Consulta JSF rechazada"]) assert.ok(html.includes(value), value);
  assert.match(html, /aria-valuenow="33"/);
});

test("unknown total renders accessible indeterminate progress without invented percentage", () => {
  const current = job("RUNNING", { totalDays: null });
  assert.equal(syncPercentage(current), null);
  const html = renderToStaticMarkup(createElement(card.SyncProgressCard, { job: current, title: "Progreso" }));
  assert.match(html, /role="progressbar"/); assert.ok(!html.includes("aria-valuenow")); assert.match(html, /Calculando progreso/);
});

test("enabled configuration and shared credential alone never mean connector verified", () => {
  assert.equal(connectionLabel("VERIFIED", null, credential.verifiedAt.toISOString()), "Configurado");
  assert.equal(connectionLabel("PENDING_VERIFICATION", job("SUCCEEDED"), null), "Verificando");
  assert.equal(connectionLabel("VERIFIED", job("SUCCEEDED"), credential.verifiedAt.toISOString()), "Conectado y verificado");
  assert.equal(connectionLabel("INVALID", job("FAILED", { errorCode: "INVALID_CREDENTIALS" })), "Error de autenticación");
  assert.equal(connectionLabel("VERIFIED", job("FAILED")), "Error de consulta");
  assert.equal(connectionLabel("VERIFIED", job("RUNNING")), "Sincronizando");
  assert.equal(connectionLabel("VERIFIED", job("QUEUED", { type: "VERIFY_CONNECTION" })), "Verificando");
  assert.equal(connectionLabel("HUMAN_VERIFICATION_REQUIRED", null), "Verificación humana requerida");
});

test("sales links select the corresponding tab and reuse the same screen", () => {
  const ids = ["consolidated", "import", "automatic"] as const;
  for (let index = 0; index < ids.length; index++) {
    const html = renderToStaticMarkup(createElement(salesUI.SalesImportClient, { activeTab: ids[index] }));
    assert.ok([...html.matchAll(/<a\b[^>]*>/g)].some(([tag]) => tag.includes(`href="${SRI_SALES_NAVIGATION[index]!.href}"`) && tag.includes('aria-current="page"')));
  }
  assert.match(readFileSync("app/facturacion/sales/imports/file/page.tsx", "utf8"), /activeTab="import"/);
  assert.match(readFileSync("app/facturacion/sales/imports/automatic/page.tsx", "utf8"), /activeTab="automatic"/);
});

test("purchases has the same three visible tabs on each existing route", () => {
  for (const { href } of SRI_PURCHASES_NAVIGATION) {
    const html = renderToStaticMarkup(createElement(purchasesTabs.PurchasesImportTabs, { activeHref: href }));
    for (const title of ["Consolidado", "Importar archivo", "Importación automática"]) assert.ok(html.includes(title));
    assert.ok([...html.matchAll(/<a\b[^>]*>/g)].some(([tag]) => tag.includes(`href="${href}"`) && tag.includes('aria-current="page"')));
    assert.ok(readFileSync(`app${href}/page.tsx`, "utf8").includes("PurchasesImportTabs"));
  }
});

test("jobs APIs enforce session tenant and retain failed job progress on reload", async () => {
  const sales = await (await salesJobs.GET(new NextRequest("http://localhost/api/sales-import/sync-jobs?tenantId=attacker"))).json();
  assert.equal(sales.jobs[0].status, "FAILED"); assert.equal(sales.jobs[0].completedDays, 1);
  const purchases = await (await purchaseJobs.GET(new NextRequest("http://localhost/api/purchases/sri-sync/jobs?tenantId=attacker"))).json();
  assert.equal(purchases.items[0].errorMessage, "Consulta JSF rechazada por el portal");
  const state = await status.getSyncStatus("tenant-session");
  assert.equal(state.activeJob, null); assert.equal(state.latestJob?.status, "FAILED");
});

test("manual sync returns the real queued job immediately, starts Jan 1, ignores browser tenant", async () => {
  const response = await salesAuto.POST(new Request("http://localhost/api/sales-import/auto-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "manual_sync", tenantId: "attacker" }) }));
  const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.job.status, "QUEUED"); assert.equal(data.jobId, data.job.id);
  assert.equal(createdTenant, "tenant-session"); assert.match(data.job.dateFrom, /-01-01T05:00:00.000Z$/);
});

test("auto-sync GET returns only public credential metadata, never encrypted material", async () => {
  const response = await salesAuto.GET(); const data = await response.json();
  assert.equal(data.credential.configured, true); assert.notEqual(data.credential.usernameMasked, credential.username);
  const body = JSON.stringify(data);
  for (const secret of ["encryptedPassword", "encryptionIv", "authTag", "private-encrypted-fixture", "private-tag", credential.username]) assert.ok(!body.includes(secret));
  const purchases = readFileSync("app/facturacion/purchases/automatic-download/automatic-download-client.tsx", "utf8");
  assert.ok(!purchases.includes('type="password"')); assert.ok(purchases.includes("/facturacion/configuration?tab=sri"));
});

test("both automatic screens consume the real jobs API and shared polling cleans up", () => {
  for (const [file, endpoint] of [["app/facturacion/sales/imports/sales-import-client.tsx", "/api/sales-import/sync-jobs"], ["app/facturacion/purchases/automatic-download/automatic-download-client.tsx", "/api/purchases/sri-sync/jobs"]]) {
    const source = readFileSync(file!, "utf8"); assert.ok(source.includes(endpoint!)); assert.ok(source.includes("progress.trackJob")); assert.ok(source.includes("progress.job")); assert.ok(source.includes("SyncProgressCard"));
  }
  const hook = readFileSync("components/appsolux/sri-tax/use-sync-jobs.ts", "utf8");
  assert.match(hook, /clearTimeout/); assert.match(hook, /abort\(\)/); assert.match(hook, /cache: "no-store"/);
});


test("XML import service creates an external document, deduplicates within tenant and preserves imported records", async () => {
  const { importSalesXml } = await import("./sales-xml-import");
  const key = "1710202601179000000000120010010000000011234567817";
  const xml = `<factura><infoTributaria><claveAcceso>${key}</claveAcceso><ruc>1790000000001</ruc><codDoc>01</codDoc><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial></infoTributaria><infoFactura><fechaEmision>17/10/2026</fechaEmision><totalSinImpuestos>10</totalSinImpuestos><importeTotal>10</importeTotal></infoFactura></factura>`;
  const first = await importSalesXml("tenant-session", xml, "1790000000001");
  assert.equal(first.ok, true); assert.equal(importedRows.length, 1);
  const original = JSON.stringify(importedRows[0]);
  const duplicate = await importSalesXml("tenant-session", xml, "1790000000001");
  assert.equal(duplicate.ok, false); assert.match(duplicate.error, /ya está registrado/);
  assert.equal(importedRows.length, 1); assert.equal(JSON.stringify(importedRows[0]), original);
  assert.equal(importedRows[0]!.source, "SRI_FACTURADOR");
  assert.equal((await importSalesXml("another-tenant", xml, "1790000000001")).ok, true);
  assert.equal(importedRows.length, 2);
  const wrongIssuer = await importSalesXml("tenant-session", xml, "1799999999001");
  assert.equal(wrongIssuer.ok, false); assert.equal(importedRows.length, 2);
});
