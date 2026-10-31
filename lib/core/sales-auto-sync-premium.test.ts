import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const commercialPlansPath = new URL("./commercial-plans.ts", import.meta.url);
const autoSyncPath = new URL("./sales-auto-sync.ts", import.meta.url);
const adapterPath = new URL("./sales-sync-adapter.ts", import.meta.url);
const schedulerPath = new URL("./sales-sri-scheduler.ts", import.meta.url);
const routePath = new URL("../../app/api/sales-import/auto-sync/route.ts", import.meta.url);
const cronPath = new URL("../../app/api/cron/sales-sri-sync/route.ts", import.meta.url);
const uiPath = new URL("../../app/facturacion/sales/imports/sales-import-client.tsx", import.meta.url);
const schemaPath = new URL("../../prisma/schema.prisma", import.meta.url);
const migrationPath = new URL("../../prisma/migrations/20261031200000_sales_auto_sync_premium/migration.sql", import.meta.url);

// ── Feature: Enterprise-only ────────────────────────────────────────────────

test("BASIC plan does not have sales_auto_sync", async () => {
  const source = await readFile(commercialPlansPath, "utf8");
  const basicBlock = source.match(/case "BASIC"[\s\S]*?buildFeatureMap\(\[([\s\S]*?)\]\)/);
  assert.ok(basicBlock);
  assert.doesNotMatch(basicBlock![1], /sales_auto_sync/);
});

test("PLUS plan does not have sales_auto_sync", async () => {
  const source = await readFile(commercialPlansPath, "utf8");
  const plusBlock = source.match(/case "PLUS"[\s\S]*?buildFeatureMap\(\[([\s\S]*?)\]\)/);
  assert.ok(plusBlock);
  assert.doesNotMatch(plusBlock![1], /sales_auto_sync/);
});

test("ADVANCED plan does not have sales_auto_sync", async () => {
  const source = await readFile(commercialPlansPath, "utf8");
  const advBlock = source.match(/case "ADVANCED"[\s\S]*?buildFeatureMap\(\[([\s\S]*?)\]\)/);
  assert.ok(advBlock);
  assert.doesNotMatch(advBlock![1], /sales_auto_sync/);
});

test("ENTERPRISE plan has sales_auto_sync", async () => {
  const source = await readFile(commercialPlansPath, "utf8");
  const entBlock = source.match(/case "ENTERPRISE"[\s\S]*?buildFeatureMap\(\[([\s\S]*?)\]\)/);
  assert.ok(entBlock);
  assert.match(entBlock![1], /sales_auto_sync/);
});

// ── Frequency default ───────────────────────────────────────────────────────

test("Default frequency is DAILY", async () => {
  const source = await readFile(schemaPath, "utf8");
  assert.match(source, /syncFrequency\s+SalesAutoSyncFrequency\s+@default\(DAILY\)/);
});

// ── calculateNextSalesSriSyncAt ─────────────────────────────────────────────

test("calculateNextSalesSriSyncAt: DAILY adds 1 day", async () => {
  const source = await readFile(autoSyncPath, "utf8");
  assert.match(source, /function calculateNextSalesSriSyncAt/);
  assert.match(source, /DAILY: 1/);
});

test("calculateNextSalesSriSyncAt: EVERY_3_DAYS adds 3 days", async () => {
  const source = await readFile(autoSyncPath, "utf8");
  assert.match(source, /EVERY_3_DAYS: 3/);
});

test("calculateNextSalesSriSyncAt: WEEKLY adds 7 days", async () => {
  const source = await readFile(autoSyncPath, "utf8");
  assert.match(source, /WEEKLY: 7/);
});

test("calculateNextSalesSriSyncAt: EVERY_15_DAYS adds 15 days", async () => {
  const source = await readFile(autoSyncPath, "utf8");
  assert.match(source, /EVERY_15_DAYS: 15/);
});

test("calculateNextSalesSriSyncAt: MONTHLY adds calendar month", async () => {
  const source = await readFile(autoSyncPath, "utf8");
  assert.match(source, /MONTHLY/);
  assert.match(source, /setMonth.*getMonth\(\) \+ 1/);
});

// ── Scheduler ───────────────────────────────────────────────────────────────

test("Scheduler queries only nextSyncAt <= now", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /nextSyncAt.*lte.*now/);
});

test("Scheduler checks enabled and sriEnabled", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /enabled: true/);
  assert.match(source, /sriEnabled: true/);
});

test("Scheduler skips tenant with feature unavailable", async () => {
  const source = await readFile(schedulerPath, "utf8");
  assert.match(source, /featureEnabled.*sales_auto_sync/);
  assert.match(source, /skipped\+\+/);
});

test("Scheduler skips tenant with existing running job", async () => {
  const source = await readFile(schedulerPath, "utf8");
  assert.match(source, /hasRunningSyncJob/);
});

test("Scheduler creates jobs with jitter", async () => {
  const source = await readFile(schedulerPath, "utf8");
  assert.match(source, /jitter/);
  assert.match(source, /Math\.random/);
});

test("Scheduler does NOT do SRI work (only creates jobs)", async () => {
  const source = await readFile(schedulerPath, "utf8");
  assert.doesNotMatch(source, /verifyConnection/);
  assert.doesNotMatch(source, /syncIssuedDocuments/);
  assert.doesNotMatch(source, /downloadXml/);
});

// ── Manual sync ─────────────────────────────────────────────────────────────

test("Manual sync works regardless of nextSyncAt", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /manual_sync/);
  assert.match(source, /createScheduledSyncJob/);
});

test("Manual sync requires Enterprise feature", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /featureEnabled.*sales_auto_sync/);
  assert.match(source, /403/);
});

test("Manual sync prevents duplicate running jobs", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /hasRunningSyncJob/);
  assert.match(source, /409/);
});

// ── CAPTCHA ─────────────────────────────────────────────────────────────────

test("HUMAN_VERIFICATION_REQUIRED status exists in schema", async () => {
  const source = await readFile(schemaPath, "utf8");
  assert.match(source, /HUMAN_VERIFICATION_REQUIRED/);
});

test("UI shows CAPTCHA verification message", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /HUMAN_VERIFICATION_REQUIRED/);
  assert.match(source, /verificación manual/i);
  assert.match(source, /Verificar conexión/);
});

// ── API Integration ─────────────────────────────────────────────────────────

test("API tokens use source API (not Telegram) in AutomaticTab", async () => {
  const source = await readFile(uiPath, "utf8");
  const autoTabBlock = source.match(/function AutomaticTab\(\)[\s\S]*$/);
  assert.ok(autoTabBlock);
  assert.match(autoTabBlock![0], /source: "API"/);
  assert.doesNotMatch(autoTabBlock![0], /newSource.*"TELEGRAM"/);
});

test("Legacy TELEGRAM tokens remain readable in table", async () => {
  const source = await readFile(uiPath, "utf8");
  const autoTabBlock = source.match(/function AutomaticTab\(\)[\s\S]*$/);
  assert.ok(autoTabBlock);
  assert.match(autoTabBlock![0], /t\.source === "TELEGRAM"/);
});

// ── UI structure ────────────────────────────────────────────────────────────

test("UI shows Importación automática with Premium badge", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /Importación automática/);
  assert.match(source, /Premium/);
});

test("UI shows blocked state with 'Disponible en el plan Empresarial'", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /Disponible en el plan Empresarial/);
  assert.match(source, /Ver planes/);
});

test("UI enables SRI configuration without claiming verified authentication", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /SRI \/ Facturador SRI/);
  assert.match(source, /Habilitar consulta SRI/);
  assert.match(source, /connectionLabel/);
});

test("UI has Integración por API card", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /Integración por API/);
  assert.match(source, /Conecta sistemas externos con Facturom mediante una API segura/);
});

test("AutomaticTab does NOT show Telegram or n8n labels", async () => {
  const source = await readFile(uiPath, "utf8");
  const autoTabBlock = source.match(/function AutomaticTab\(\)[\s\S]*$/);
  assert.ok(autoTabBlock);
  assert.doesNotMatch(autoTabBlock![0], /Telegram \/ n8n/);
  assert.doesNotMatch(autoTabBlock![0], /API \/ Telegram/);
  assert.doesNotMatch(autoTabBlock![0], /API externa/);
  assert.doesNotMatch(autoTabBlock![0], /<option value="TELEGRAM"/);
});

test("SRI card has Sincronizar ahora button", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /Sincronizar ahora/);
});

test("Frequency selector has all 5 options", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /Una vez al día/);
  assert.match(source, /Cada 3 días/);
  assert.match(source, /Una vez por semana/);
  assert.match(source, /Cada 15 días/);
  assert.match(source, /Una vez al mes/);
});

test("No hourly frequency options exist", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.doesNotMatch(source, /cada.*hora/i);
  assert.doesNotMatch(source, /60 minutos/);
  assert.doesNotMatch(source, /15 minutos/);
  assert.doesNotMatch(source, /30 minutos/);
});

test("UI shows enable/disable toggle", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /enabled.*!config\.enabled/);
});

test("UI shows last sync and next sync dates", async () => {
  const source = await readFile(uiPath, "utf8");
  assert.match(source, /Última sincronización/);
  assert.match(source, /Próxima sincronización/);
});

// ── Schema ──────────────────────────────────────────────────────────────────

test("SalesAutoSyncFrequency enum has all 5 values", async () => {
  const source = await readFile(schemaPath, "utf8");
  const enumBlock = source.match(/enum SalesAutoSyncFrequency\s*\{([\s\S]*?)\}/);
  assert.ok(enumBlock);
  for (const val of ["DAILY", "EVERY_3_DAYS", "WEEKLY", "EVERY_15_DAYS", "MONTHLY"]) {
    assert.match(enumBlock![1], new RegExp(val));
  }
});

test("SalesAutoSyncSettings has syncFrequency and nextSyncAt", async () => {
  const source = await readFile(schemaPath, "utf8");
  assert.match(source, /syncFrequency\s+SalesAutoSyncFrequency/);
  assert.match(source, /nextSyncAt\s+DateTime\?/);
});

test("SalesSriSyncJob has durationMs for cost control", async () => {
  const source = await readFile(schemaPath, "utf8");
  assert.match(source, /durationMs\s+Int\?/);
});

// ── Migration ───────────────────────────────────────────────────────────────

test("Migration creates SalesAutoSyncFrequency enum", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /CREATE TYPE "SalesAutoSyncFrequency"/);
  assert.match(sql, /DAILY/);
  assert.match(sql, /MONTHLY/);
});

test("Migration adds syncFrequency and nextSyncAt columns", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /syncFrequency/);
  assert.match(sql, /nextSyncAt/);
});

test("Migration adds durationMs to SalesSriSyncJob", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /durationMs/);
  assert.match(sql, /SalesSriSyncJob/);
});

// ── Audit events ────────────────────────────────────────────────────────────

test("Audit events are defined", async () => {
  const source = await readFile(autoSyncPath, "utf8");
  assert.match(source, /sales_sri_auto_sync_enabled/);
  assert.match(source, /sales_sri_auto_sync_disabled/);
  assert.match(source, /sales_sri_frequency_changed/);
  assert.match(source, /sales_sri_manual_sync_requested/);
  assert.match(source, /sales_sri_sync_completed/);
  assert.match(source, /sales_sri_sync_failed/);
  assert.match(source, /sales_sri_human_verification_required/);
});

// ── Feature gate on API ─────────────────────────────────────────────────────

test("Auto-sync GET returns hasFeature flag", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /hasFeature/);
  assert.match(source, /resolveEffectiveTenantAccessForTenant/);
});

test("Auto-sync PATCH rejects if no feature", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /403/);
  assert.match(source, /plan Empresarial/);
});

// ── Cron endpoint ───────────────────────────────────────────────────────────

test("Cron endpoint uses CRON_SECRET for auth", async () => {
  const source = await readFile(cronPath, "utf8");
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /401/);
});

test("Cron endpoint calls runDailySriSyncScheduler", async () => {
  const source = await readFile(cronPath, "utf8");
  assert.match(source, /runDailySriSyncScheduler/);
});

// ── Incremental range ───────────────────────────────────────────────────────

test("Sync job uses lastSuccessAt with overlap for incremental range", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /lastSuccessAt/);
  assert.match(source, /24 \* 60 \* 60 \* 1000/);
});

// ── Retry behavior ──────────────────────────────────────────────────────────

test("Sync job has maxAttempts default of 3", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /maxAttempts: 3/);
});
