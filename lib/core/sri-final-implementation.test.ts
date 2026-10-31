import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  SRI_TAX_NAVIGATION,
  SRI_SALES_NAVIGATION,
  SRI_PURCHASES_NAVIGATION,
  SRI_CONFIGURATION_NAVIGATION,
} from "../../config/sri-tax-navigation";
import { buildSidebarNavigation } from "../../components/appsolux/layout/sidebar";
import type { TenantModeState } from "./tenant-mode";

// ══════════════════════════════════════════════════════════════════════════════
// NAV. Navigation — Ventas & Compras submenus in sidebar
// ══════════════════════════════════════════════════════════════════════════════

test("NAV01 – SRI_SALES_NAVIGATION has 3 entries: Consolidado, Importar archivo, Importación automática", () => {
  assert.equal(SRI_SALES_NAVIGATION.length, 3);
  assert.deepEqual(
    SRI_SALES_NAVIGATION.map((i) => i.title),
    ["Consolidado", "Importar archivo", "Importación automática"],
  );
});

test("NAV02 – SRI_PURCHASES_NAVIGATION has 3 entries: Consolidado, Importar archivo, Importación automática", () => {
  assert.equal(SRI_PURCHASES_NAVIGATION.length, 3);
  assert.deepEqual(
    SRI_PURCHASES_NAVIGATION.map((i) => i.title),
    ["Consolidado", "Importar archivo", "Importación automática"],
  );
});

test("NAV03 – Purchases navigation points to correct routes", () => {
  const hrefs = SRI_PURCHASES_NAVIGATION.map((i) => i.href);
  assert.ok(hrefs.includes("/facturacion/purchases/consolidated"));
  assert.ok(hrefs.includes("/facturacion/purchases/txt-import"));
  assert.ok(hrefs.includes("/facturacion/purchases/automatic-download"));
});

test("NAV04 – Sales navigation points to correct routes", () => {
  const hrefs = SRI_SALES_NAVIGATION.map((i) => i.href);
  assert.ok(hrefs.includes("/facturacion/sales/imports"));
  assert.ok(hrefs.includes("/facturacion/sales/imports/sync-history"));
});

test("NAV05 – sidebar builds with sri group containing Ventas and Compras submenus", () => {
  const nav = buildSidebarNavigation({} as TenantModeState);
  const sri = nav.find((g) => g.key === "sri");
  assert.ok(sri, "SRI group must exist in sidebar");
  const titles = sri.items.map((i) => i.title);
  assert.ok(titles.includes("Ventas"), "Ventas submenu must be in sidebar");
  assert.ok(titles.includes("Compras"), "Compras submenu must be in sidebar");
});

test("NAV06 – sidebar Ventas submenu has correct items", () => {
  const nav = buildSidebarNavigation({} as TenantModeState);
  const sri = nav.find((g) => g.key === "sri")!;
  const ventas = sri.items.find(
    (i) => i.title === "Ventas" && "kind" in i && i.kind === "submenu",
  ) as { title: string; kind: string; items: { title: string }[] } | undefined;
  assert.ok(ventas, "Ventas submenu must exist in SRI group");
  assert.deepEqual(
    ventas.items.map((c) => c.title),
    ["Consolidado", "Importar archivo", "Importación automática"],
  );
});

test("NAV07 – sidebar Compras submenu has correct items", () => {
  const nav = buildSidebarNavigation({} as TenantModeState);
  const sri = nav.find((g) => g.key === "sri")!;
  const compras = sri.items.find(
    (i) => i.title === "Compras" && "kind" in i && i.kind === "submenu",
  ) as { title: string; kind: string; items: { title: string }[] } | undefined;
  assert.ok(compras, "Compras submenu must exist in SRI group");
  assert.deepEqual(
    compras.items.map((c) => c.title),
    ["Consolidado", "Importar archivo", "Importación automática"],
  );
});

test("NAV08 – existing SRI_TAX_NAVIGATION entries remain in sidebar", () => {
  const nav = buildSidebarNavigation({} as TenantModeState);
  const sri = nav.find((g) => g.key === "sri")!;
  for (const item of SRI_TAX_NAVIGATION) {
    assert.ok(
      sri.items.some((i) => i.title === item.title),
      `Missing: ${item.title}`,
    );
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CFG. SRI Credentials centralized in Configuración
// ══════════════════════════════════════════════════════════════════════════════

test("CFG01 – SRI_CONFIGURATION_NAVIGATION includes 'Credenciales SRI' link to /facturacion/configuration", () => {
  const cred = SRI_CONFIGURATION_NAVIGATION.find(
    (i) => i.title === "Credenciales SRI",
  );
  assert.ok(cred, "Credenciales SRI entry must exist");
  assert.equal(cred!.href, "/facturacion/configuration");
});

test("CFG02 – configuration page client imports SriCredentialsSection", () => {
  const src = readFileSync(
    "components/appsolux/settings/configuration-page-client.tsx",
    "utf8",
  );
  assert.match(src, /SriCredentialsSection/);
  assert.match(src, /activeTab === "sri"/);
});

test("CFG03 – SriCredentialsSection component file exists", () => {
  assert.ok(
    existsSync("components/appsolux/sri-tax/sri-credentials-section.tsx"),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// PGS. Pages — Purchases Consolidated, TXT Import, Automatic Download
// ══════════════════════════════════════════════════════════════════════════════

test("PGS01 – Purchases Consolidated page file exists", () => {
  assert.ok(
    existsSync("app/facturacion/purchases/consolidated/page.tsx"),
  );
});

test("PGS02 – Purchases Consolidated client component exists", () => {
  assert.ok(
    existsSync(
      "app/facturacion/purchases/consolidated/purchases-consolidated-client.tsx",
    ),
  );
});

test("PGS03 – Purchases Consolidated client has filter capabilities", () => {
  const src = readFileSync(
    "app/facturacion/purchases/consolidated/purchases-consolidated-client.tsx",
    "utf8",
  );
  assert.match(src, /from.*date|setFrom/i);
  assert.match(src, /to.*date|setTo/i);
  assert.match(src, /typeFilter|tipo/i);
  assert.match(src, /statusFilter|estado/i);
  assert.match(src, /originFilter|origen/i);
});

test("PGS04 – Purchases Consolidated client has XML viewer", () => {
  const src = readFileSync(
    "app/facturacion/purchases/consolidated/purchases-consolidated-client.tsx",
    "utf8",
  );
  assert.match(src, /xmlContent|xmlViewer|ViewXml|xmlDoc/i);
});

test("PGS05 – Purchases Consolidated API route exists", () => {
  assert.ok(existsSync("app/api/purchases/consolidated/route.ts"));
});

test("PGS06 – Purchases Consolidated API uses tenant from session", () => {
  const src = readFileSync("app/api/purchases/consolidated/route.ts", "utf8");
  assert.match(src, /requireDashboardSession|getServerSession/);
  assert.match(src, /tenant/);
});

test("PGS07 – Purchases TXT Import page exists", () => {
  assert.ok(
    existsSync("app/facturacion/purchases/txt-import/page.tsx") ||
      existsSync("app/facturacion/purchases/txt-import/page.ts"),
  );
});

test("PGS08 – Purchases Automatic Download client exists", () => {
  assert.ok(
    existsSync(
      "app/facturacion/purchases/automatic-download/automatic-download-client.tsx",
    ),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// PRG. Progress Bar — SyncProgressCard integration
// ══════════════════════════════════════════════════════════════════════════════

test("PRG01 – SyncProgressCard component file exists", () => {
  assert.ok(
    existsSync("components/appsolux/sri-tax/sync-progress-card.tsx"),
  );
});

test("PRG02 – SyncProgressCard exports SyncJobProgress type", () => {
  const src = readFileSync(
    "components/appsolux/sri-tax/sync-progress-card.tsx",
    "utf8",
  );
  assert.match(src, /export type SyncJobProgress/);
});

test("PRG03 – SyncProgressCard has status labels for all expected states", () => {
  const src = readFileSync(
    "components/appsolux/sri-tax/sync-progress-card.tsx",
    "utf8",
  );
  for (const status of [
    "QUEUED",
    "RUNNING",
    "SUCCEEDED",
    "PARTIAL",
    "FAILED",
    "HUMAN_VERIFICATION_REQUIRED",
  ]) {
    assert.match(
      src,
      new RegExp(status),
      `Missing status label for ${status}`,
    );
  }
});

test("PRG04 – SyncProgressCard renders progress percentage from completedDays/totalDays", () => {
  const src = readFileSync(
    "components/appsolux/sri-tax/sync-progress-card.tsx",
    "utf8",
  );
  assert.match(src, /completedDays/);
  assert.match(src, /totalDays/);
  assert.match(src, /percentage/);
});

test("PRG05 – SyncProgressCard handles indeterminate progress (null totalDays)", () => {
  const src = readFileSync(
    "components/appsolux/sri-tax/sync-progress-card.tsx",
    "utf8",
  );
  assert.match(src, /Calculando progreso/);
});

test("PRG06 – Purchases automatic download client imports SyncProgressCard", () => {
  const src = readFileSync(
    "app/facturacion/purchases/automatic-download/automatic-download-client.tsx",
    "utf8",
  );
  assert.match(src, /SyncProgressCard/);
  assert.match(src, /sync-progress-card/);
});

test("PRG07 – Sales sync history client imports SyncProgressCard", () => {
  const src = readFileSync(
    "app/facturacion/sales/imports/sync-history/sync-history-client.tsx",
    "utf8",
  );
  assert.match(src, /SyncProgressCard/);
  assert.match(src, /sync-progress-card/);
});

test("PRG08 – Purchases automatic download has polling for sync progress", () => {
  const src = readFileSync(
    "app/facturacion/purchases/automatic-download/automatic-download-client.tsx",
    "utf8",
  );
  assert.match(src, /startSyncPolling/);
  assert.match(src, /setInterval/);
});

test("PRG09 – Sales sync history client has polling for active jobs", () => {
  const src = readFileSync(
    "app/facturacion/sales/imports/sync-history/sync-history-client.tsx",
    "utf8",
  );
  assert.match(src, /pollRef/);
  assert.match(src, /activeJob/);
});

// ══════════════════════════════════════════════════════════════════════════════
// SCH. Schema — Progress fields on sync job models
// ══════════════════════════════════════════════════════════════════════════════

test("SCH01 – PurchaseSriSyncJob schema has progress fields", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const purchaseModel = schema.slice(
    schema.indexOf("model PurchaseSriSyncJob"),
    schema.indexOf("}", schema.indexOf("model PurchaseSriSyncJob")) + 1,
  );
  assert.match(purchaseModel, /checkpointDate/);
  assert.match(purchaseModel, /totalDays/);
  assert.match(purchaseModel, /completedDays/);
  assert.match(purchaseModel, /currentDateLabel/);
  assert.match(purchaseModel, /durationMs/);
});

test("SCH02 – SalesSriSyncJob schema has progress fields", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const salesModel = schema.slice(
    schema.indexOf("model SalesSriSyncJob"),
    schema.indexOf("}", schema.indexOf("model SalesSriSyncJob")) + 1,
  );
  assert.match(salesModel, /checkpointDate/);
  assert.match(salesModel, /totalDays/);
  assert.match(salesModel, /completedDays/);
  assert.match(salesModel, /currentDateLabel/);
});

test("SCH03 – Purchase sync job progress migration exists", () => {
  assert.ok(
    existsSync(
      "prisma/migrations/20261031500000_add_purchase_sync_job_progress/migration.sql",
    ),
  );
});

test("SCH04 – Sales sync job progress migration exists", () => {
  assert.ok(
    existsSync(
      "prisma/migrations/20261031600000_add_sales_sync_job_progress/migration.sql",
    ),
  );
});

test("SCH05 – Purchase progress migration adds correct columns", () => {
  const sql = readFileSync(
    "prisma/migrations/20261031500000_add_purchase_sync_job_progress/migration.sql",
    "utf8",
  );
  assert.match(sql, /PurchaseSriSyncJob/);
  assert.match(sql, /checkpointDate/);
  assert.match(sql, /totalDays/);
  assert.match(sql, /completedDays/);
  assert.match(sql, /currentDateLabel/);
  assert.match(sql, /durationMs/);
});

test("SCH06 – Sales progress migration adds correct columns", () => {
  const sql = readFileSync(
    "prisma/migrations/20261031600000_add_sales_sync_job_progress/migration.sql",
    "utf8",
  );
  assert.match(sql, /SalesSriSyncJob/);
  assert.match(sql, /totalDays/);
  assert.match(sql, /completedDays/);
  assert.match(sql, /currentDateLabel/);
});

// ══════════════════════════════════════════════════════════════════════════════
// API. API routes — sync status includes progress
// ══════════════════════════════════════════════════════════════════════════════

test("API01 – Purchase sync status API returns progress fields", () => {
  const src = readFileSync("lib/core/purchase-sync-jobs.ts", "utf8");
  assert.match(src, /checkpointDate/);
  assert.match(src, /totalDays/);
  assert.match(src, /completedDays/);
  assert.match(src, /currentDateLabel/);
  assert.match(src, /documentsFound/);
  assert.match(src, /documentsImported/);
  assert.match(src, /documentsSkipped/);
  assert.match(src, /documentsFailed/);
});

test("API02 – Sales sync jobs API route selects progress fields", () => {
  const src = readFileSync("app/api/sales-import/sync-jobs/route.ts", "utf8");
  assert.match(src, /totalDays/);
  assert.match(src, /completedDays/);
  assert.match(src, /currentDateLabel/);
  assert.match(src, /checkpointDate/);
});

test("API03 – Purchase sync status getSyncStatus returns activeJob with progress data", () => {
  const src = readFileSync("lib/core/purchase-sync-jobs.ts", "utf8");
  assert.match(src, /activeJob/);
  assert.match(src, /totalDays: activeJob\.totalDays/);
  assert.match(src, /completedDays: activeJob\.completedDays/);
});

// ══════════════════════════════════════════════════════════════════════════════
// TI. Tenant Isolation — all APIs use session tenant
// ══════════════════════════════════════════════════════════════════════════════

test("TI01 – Purchase consolidated API requires dashboard session", () => {
  const src = readFileSync("app/api/purchases/consolidated/route.ts", "utf8");
  assert.match(src, /requireDashboardSession/);
  assert.doesNotMatch(src, /req\..*tenantId/);
});

test("TI02 – Purchase sync job functions take tenantId as parameter", () => {
  const src = readFileSync("lib/core/purchase-sync-jobs.ts", "utf8");
  assert.match(src, /getActiveJob\(tenantId: string\)/);
  assert.match(src, /getSyncStatus\(tenantId: string\)/);
  assert.match(src, /createSyncJob\(\s*tenantId: string/);
});

test("TI03 – Sales sync jobs API requires dashboard session", () => {
  const src = readFileSync("app/api/sales-import/sync-jobs/route.ts", "utf8");
  assert.match(src, /requireDashboardSession/);
  assert.match(src, /tenant\.id/);
});

// ══════════════════════════════════════════════════════════════════════════════
// SEC. Security — no credentials in logs, no browser automation
// ══════════════════════════════════════════════════════════════════════════════

test("SEC01 – SRI credentials section does not expose decrypted stored password to browser", () => {
  const src = readFileSync(
    "components/appsolux/sri-tax/sri-credentials-section.tsx",
    "utf8",
  );
  assert.doesNotMatch(src, /decryptedPassword/);
  assert.doesNotMatch(src, /encryptedPassword/);
  assert.doesNotMatch(src, /masterKey/);
  assert.doesNotMatch(src, /authTag/);
});

test("SEC02 – Purchase sync jobs module has server-only guard", () => {
  const src = readFileSync("lib/core/purchase-sync-jobs.ts", "utf8");
  assert.match(src, /server-only/);
});

test("SEC03 – No Playwright, Chromium or Selenium references in dashboard SRI code", () => {
  const files = [
    "lib/core/purchase-sync-jobs.ts",
    "lib/core/purchase-documents.ts",
    "components/appsolux/sri-tax/sri-credentials-section.tsx",
    "components/appsolux/sri-tax/sync-progress-card.tsx",
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /playwright/i, `${file} references playwright`);
    assert.doesNotMatch(src, /chromium/i, `${file} references chromium`);
    assert.doesNotMatch(src, /selenium/i, `${file} references selenium`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// UBU. Ubuntu SRI corrections — Keycloak, JSF, form fields
// ══════════════════════════════════════════════════════════════════════════════

test("UBU01 – Worker keycloak-auth.ts supports unquoted attribute parsing", () => {
  const src = readFileSync(
    "../appsolux-workers/sri-sales-sync-worker/src/sri/keycloak-auth.ts",
    "utf8",
  );
  assert.match(src, /unquoted/i);
});

test("UBU02 – Worker portal-contract.ts has strengthened authentication detection", () => {
  const src = readFileSync(
    "../appsolux-workers/sri-sales-sync-worker/src/sri/portal-contract.ts",
    "utf8",
  );
  assert.match(src, /strong/i);
});

test("UBU03 – Worker sri-emitted-documents.ts uses buildSearchFormParams with frmPrincipal fields", () => {
  const src = readFileSync(
    "../appsolux-workers/sri-sales-sync-worker/src/sri/sri-emitted-documents.ts",
    "utf8",
  );
  assert.match(src, /buildSearchFormParams/);
  assert.match(src, /opciones.*ruc/);
  assert.match(src, /cmbEstadoAutorizacion.*AUT/);
  assert.match(src, /calendarFechaDesde_input/);
});

test("UBU04 – Worker config has tuportal Keycloak entry URL", () => {
  const src = readFileSync(
    "../appsolux-workers/sri-sales-sync-worker/src/config.ts",
    "utf8",
  );
  assert.match(src, /tuportal-internet\/accederAplicacion\.jspa/);
  assert.match(src, /redireccion=60/);
});

// ══════════════════════════════════════════════════════════════════════════════
// CKP. Checkpoints — day-by-day sync with resume
// ══════════════════════════════════════════════════════════════════════════════

test("CKP01 – Worker uses generateDailyDates for day-by-day iteration", () => {
  const src = readFileSync(
    "../appsolux-workers/sri-sales-sync-worker/src/worker.ts",
    "utf8",
  );
  assert.match(src, /generateDailyDates/);
  assert.match(src, /resumeDateFrom/);
  assert.match(src, /updateJobCheckpoint/);
});

test("CKP02 – Worker saves checkpoint per day and logs CHECKPOINT_SAVED", () => {
  const src = readFileSync(
    "../appsolux-workers/sri-sales-sync-worker/src/worker.ts",
    "utf8",
  );
  assert.match(src, /CHECKPOINT_SAVED/);
});

test("CKP03 – SalesSriSyncJob checkpoint migration exists", () => {
  assert.ok(
    existsSync(
      "prisma/migrations/20261031400000_add_sync_job_checkpoint/migration.sql",
    ),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPAT. Compatibility — existing functionality preserved
// ══════════════════════════════════════════════════════════════════════════════

test("COMPAT01 – SRI_TAX_NAVIGATION still has all 6 entries", () => {
  assert.equal(SRI_TAX_NAVIGATION.length, 6);
  const expectedTitles = [
    "Resumen tributario",
    "Comprobantes recibidos",
    "Anexo Transaccional (ATS)",
    "Talón resumen ATS",
    "Reporte IVA 104",
    "Validaciones tributarias",
  ];
  assert.deepEqual(
    SRI_TAX_NAVIGATION.map((i) => i.title),
    expectedTitles,
  );
});

test("COMPAT02 – SRI_CONFIGURATION_NAVIGATION preserves fiscal setup routes", () => {
  for (const suffix of [
    "company",
    "signature",
    "sequences",
    "establishments",
    "issue-points",
  ]) {
    assert.ok(
      SRI_CONFIGURATION_NAVIGATION.some(
        (i) => i.href === `/facturacion/sri/${suffix}`,
      ),
      `Missing config route: /facturacion/sri/${suffix}`,
    );
  }
});

test("COMPAT03 – XML viewer API route for purchases exists", () => {
  assert.ok(
    existsSync("app/api/purchases/documents/[purchaseId]/xml/route.ts"),
  );
});

test("COMPAT04 – SRI signing worker is not modified (no imports from it)", () => {
  const files = [
    "lib/core/purchase-sync-jobs.ts",
    "lib/core/purchase-documents.ts",
    "components/appsolux/sri-tax/sync-progress-card.tsx",
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(
      src,
      /sri-signing-worker/,
      `${file} references signing worker`,
    );
  }
});
