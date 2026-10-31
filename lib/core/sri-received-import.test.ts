import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const soapClientPath = new URL("./sri-soap-client.ts", import.meta.url);
const txtParserPath = new URL("./sri-received-txt-parser.ts", import.meta.url);
const txtImportRoutePath = new URL("../../app/api/purchases/txt-import/route.ts", import.meta.url);
const txtImportPagePath = new URL("../../app/facturacion/purchases/txt-import/page.tsx", import.meta.url);
const txtImportClientPath = new URL("../../app/facturacion/purchases/txt-import/txt-import-client.tsx", import.meta.url);
const sriNavPath = new URL("../../config/sri-tax-navigation.ts", import.meta.url);
const purchaseXmlImportPath = new URL("./purchase-xml-import.ts", import.meta.url);
const credentialsPath = new URL("./purchase-sri-credentials.ts", import.meta.url);

// ══════════════════════════════════════════════════════════════════════════════
// A. SOAP Client (Dashboard)
// ══════════════════════════════════════════════════════════════════════════════

test("A01 – sri-soap-client.ts exists and exports fetchAuthorizedXml", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /export async function fetchAuthorizedXml/);
});

test("A02 – SOAP client builds envelope with access key", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /claveAccesoComprobante/);
  assert.match(source, /autorizacionComprobante/);
});

test("A03 – SOAP client uses cel.sri.gob.ec endpoint", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /cel\.sri\.gob\.ec/);
  assert.match(source, /AutorizacionComprobantesOffline/);
});

test("A04 – SOAP client parses authorized response", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /AUTORIZADO/);
  assert.match(source, /comprobante/);
  assert.match(source, /decodeCdata/);
});

test("A05 – SOAP client handles SOAP faults", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /[Ff]ault/);
  assert.match(source, /faultstring/);
});

test("A06 – SOAP client validates 49-digit access key format", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /\\d\{49\}/);
  assert.match(source, /INVALID_KEY/);
});

test("A07 – SOAP client has 30s timeout", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /30_000/);
  assert.match(source, /AbortSignal\.timeout/);
});

test("A08 – SOAP client is server-only", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /server-only/);
});

test("A09 – SOAP client exports SoapAuthorizationResult type", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /export type SoapAuthorizationResult/);
  assert.match(source, /authorized: boolean/);
  assert.match(source, /xml: string \| null/);
});

test("A10 – SOAP client does not import Playwright or Chromium", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.doesNotMatch(source, /playwright/i);
  assert.doesNotMatch(source, /chromium/i);
});

// ══════════════════════════════════════════════════════════════════════════════
// B. Received TXT Parser
// ══════════════════════════════════════════════════════════════════════════════

test("B01 – TXT parser exports parseReceivedTxt", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /export function parseReceivedTxt/);
});

test("B02 – TXT parser exports isValidAccessKey", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /export function isValidAccessKey/);
});

test("B03 – TXT parser detects RUC_EMISOR column", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /RUC_EMISOR/);
});

test("B04 – TXT parser detects CLAVE_ACCESO column", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /CLAVE_ACCESO/);
});

test("B05 – TXT parser normalizes document types", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /FACTURA/);
  assert.match(source, /LIQUIDACION_DE_COMPRA/);
  assert.match(source, /NOTA_DE_CREDITO/);
  assert.match(source, /RETENCION/);
});

test("B06 – TXT parser validates 49-digit access keys", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /\\d\{49\}/);
});

test("B07 – TXT parser exports ReceivedTxtRow type", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /export type ReceivedTxtRow/);
  assert.match(source, /emitterRuc: string/);
  assert.match(source, /emitterName: string/);
});

test("B08 – TXT parser is server-only", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /server-only/);
});

test("B09 – TXT parser handles tab-separated values", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.match(source, /split\("\\t"\)/);
});

// ══════════════════════════════════════════════════════════════════════════════
// C. TXT Import API Route
// ══════════════════════════════════════════════════════════════════════════════

test("C01 – TXT import route handles POST", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /export async function POST/);
});

test("C02 – route requires dashboard session", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /requireDashboardSession/);
});

test("C03 – route uses parseReceivedTxt", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /parseReceivedTxt/);
});

test("C04 – route uses fetchAuthorizedXml for SOAP retrieval", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /fetchAuthorizedXml/);
});

test("C05 – route uses importPurchaseXml to create documents", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /importPurchaseXml/);
});

test("C06 – route enforces MAX_ROWS limit", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /MAX_ROWS_PER_IMPORT/);
  const match = source.match(/MAX_ROWS_PER_IMPORT\s*=\s*(\d+)/);
  assert.ok(match, "MAX_ROWS_PER_IMPORT declaration not found");
  assert.ok(Number(match![1]) <= 50, "Limit must be <= 50");
});

test("C07 – route checks deduplication against existing documents", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /purchaseDocument\.findFirst/);
  assert.match(source, /accessKey/);
  assert.match(source, /already_exists/);
});

test("C08 – route returns summary with imported/skipped/failed counts", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /imported/);
  assert.match(source, /skipped/);
  assert.match(source, /failed/);
  assert.match(source, /summary/);
});

test("C09 – route handles multipart/form-data upload", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /multipart\/form-data/);
  assert.match(source, /formData/);
});

test("C10 – route has rate limiting delay between SOAP calls", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /DELAY_BETWEEN_SOAP_MS/);
  assert.match(source, /sleep/);
});

test("C11 – route validates tenant RUC against document receiver", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /tenantRuc/);
  assert.match(source, /sriTaxpayerProfile/);
});

test("C12 – route does not expose password or credentials", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.doesNotMatch(source, /password/i);
  assert.doesNotMatch(source, /credential/i);
});

// ══════════════════════════════════════════════════════════════════════════════
// D. TXT Import UI
// ══════════════════════════════════════════════════════════════════════════════

test("D01 – TXT import page uses DashboardShell", async () => {
  const source = await readFile(txtImportPagePath, "utf8");
  assert.match(source, /DashboardShell/);
  assert.match(source, /requireDashboardSession/);
});

test("D02 – TXT import client is a client component", async () => {
  const source = await readFile(txtImportClientPath, "utf8");
  assert.match(source, /"use client"/);
});

test("D03 – TXT import client has file upload input", async () => {
  const source = await readFile(txtImportClientPath, "utf8");
  assert.match(source, /type="file"/);
  assert.match(source, /\.txt/);
});

test("D04 – TXT import client calls /api/purchases/txt-import", async () => {
  const source = await readFile(txtImportClientPath, "utf8");
  assert.match(source, /\/api\/purchases\/txt-import/);
});

test("D05 – TXT import client shows summary (imported/skipped/failed)", async () => {
  const source = await readFile(txtImportClientPath, "utf8");
  assert.match(source, /Importados/);
  assert.match(source, /Ya exist/);
  assert.match(source, /Errores/);
});

test("D06 – TXT import client shows results table", async () => {
  const source = await readFile(txtImportClientPath, "utf8");
  assert.match(source, /<table/);
  assert.match(source, /RUC Emisor/);
  assert.match(source, /Emisor/);
  assert.match(source, /Estado/);
});

test("D07 – TXT import client shows instructions for obtaining TXT", async () => {
  const source = await readFile(txtImportClientPath, "utf8");
  assert.match(source, /srienlinea\.sri\.gob\.ec/);
  assert.match(source, /reCAPTCHA/);
  assert.match(source, /Descargar TXT/);
});

// ══════════════════════════════════════════════════════════════════════════════
// E. Navigation
// ══════════════════════════════════════════════════════════════════════════════

test("E01 – SRI navigation includes TXT import link", async () => {
  const source = await readFile(sriNavPath, "utf8");
  assert.match(source, /txt-import/);
  assert.match(source, /Importar archivo/);
});

test("E02 – SRI navigation includes automatic download link", async () => {
  const source = await readFile(sriNavPath, "utf8");
  assert.match(source, /automatic-download/);
  assert.match(source, /Importación automática/);
});

test("E03 – SRI navigation includes comprobantes recibidos", async () => {
  const source = await readFile(sriNavPath, "utf8");
  assert.match(source, /Comprobantes recibidos/);
  assert.match(source, /\/facturacion\/sri\/received/);
});

// ══════════════════════════════════════════════════════════════════════════════
// F. Purchase XML Import (existing — ensure no regression)
// ══════════════════════════════════════════════════════════════════════════════

test("F01 – purchase XML import parses infoTributaria", async () => {
  const source = await readFile(purchaseXmlImportPath, "utf8");
  assert.match(source, /infoTributaria/);
  assert.match(source, /claveAcceso/);
  assert.match(source, /ruc/);
});

test("F02 – purchase XML import has RUC validation", async () => {
  const source = await readFile(purchaseXmlImportPath, "utf8");
  assert.match(source, /buyerIdentification.*tenantRuc/);
});

test("F03 – purchase XML import has deduplication by accessKey", async () => {
  const source = await readFile(purchaseXmlImportPath, "utf8");
  assert.match(source, /purchaseDocument\.findFirst/);
  assert.match(source, /accessKey/);
  assert.match(source, /ya está registrado/);
});

test("F04 – purchase XML import creates inbox item", async () => {
  const source = await readFile(purchaseXmlImportPath, "utf8");
  assert.match(source, /purchaseInboxItem\.create/);
});

test("F05 – purchase XML import sets origin as XML_IMPORT", async () => {
  const source = await readFile(purchaseXmlImportPath, "utf8");
  assert.match(source, /XML_IMPORT/);
});

// ══════════════════════════════════════════════════════════════════════════════
// G. Credential Management (existing — ensure no regression)
// ══════════════════════════════════════════════════════════════════════════════

test("G01 – credential encryption uses AES-256-GCM", async () => {
  const source = await readFile(credentialsPath, "utf8");
  assert.match(source, /aes-256-gcm/);
});

test("G02 – credentials are encrypted with master key", async () => {
  const source = await readFile(credentialsPath, "utf8");
  assert.match(source, /SRI_PURCHASE_CREDENTIAL_MASTER_KEY/);
  assert.match(source, /getMasterKey/);
});

test("G03 – credential module does not expose plaintext password", async () => {
  const source = await readFile(credentialsPath, "utf8");
  assert.doesNotMatch(source, /console\.log.*password/i);
  assert.doesNotMatch(source, /return.*password.*plain/i);
});

test("G04 – maskUsername hides middle of username", async () => {
  const source = await readFile(credentialsPath, "utf8");
  assert.match(source, /maskUsername/);
  assert.match(source, /"\*"\.repeat/);
});

test("G05 – deleteCredential cleans up sync config and jobs", async () => {
  const source = await readFile(credentialsPath, "utf8");
  assert.match(source, /purchaseSriSyncConfig\.updateMany/);
  assert.match(source, /purchaseSriSyncJob\.updateMany/);
  assert.match(source, /purchaseSriCredential\.deleteMany/);
});

// ══════════════════════════════════════════════════════════════════════════════
// H. Security / Isolation
// ══════════════════════════════════════════════════════════════════════════════

test("H01 – SOAP client does not import worker modules", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.doesNotMatch(source, /sri-sales-sync-worker/);
  assert.doesNotMatch(source, /from "\.\.\/\.\.\/.*worker/);
});

test("H02 – TXT import route does not use Playwright", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.doesNotMatch(source, /playwright/i);
  assert.doesNotMatch(source, /chromium/i);
});

test("H03 – TXT import does not modify inventory, accounting, or sequences", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.doesNotMatch(source, /inventory/i);
  assert.doesNotMatch(source, /accountingEntry/i);
  assert.doesNotMatch(source, /sequential/i);
  assert.doesNotMatch(source, /cuentaPorPagar/i);
});

test("H04 – SOAP client uses only fetch (no browser dependencies)", async () => {
  const source = await readFile(soapClientPath, "utf8");
  assert.match(source, /fetch\(/);
  assert.doesNotMatch(source, /require\(/);
  assert.doesNotMatch(source, /puppeteer/i);
});

// ══════════════════════════════════════════════════════════════════════════════
// I. Historical Sync Route (Phase D)
// ══════════════════════════════════════════════════════════════════════════════

const autoSyncRoutePath = new URL("../../app/api/sales-import/auto-sync/route.ts", import.meta.url);

test("I01 – auto-sync route handles historical_sync action", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /historical_sync/);
  assert.match(source, /body\.action === "historical_sync"/);
});

test("I02 – historical_sync requires dashboard session", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /requireDashboardSession/);
});

test("I03 – historical_sync checks SRI enabled before creating job", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  const historicalBlock = source.slice(source.indexOf("historical_sync"));
  assert.match(historicalBlock, /sriEnabled/);
});

test("I04 – historical_sync checks for running jobs to prevent concurrency", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  const historicalBlock = source.slice(source.indexOf("historical_sync"));
  assert.match(historicalBlock, /hasRunningSyncJob/);
  assert.match(historicalBlock, /409/);
});

test("I05 – historical_sync creates SYNC_ISSUED_DOCUMENTS job", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /SYNC_ISSUED_DOCUMENTS/);
  assert.match(source, /salesSriSyncJob\.create/);
});

test("I06 – historical_sync defaults to January 1 of Ecuador fiscal year", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /fiscalYear/);
  assert.match(source, /America\/Guayaquil/);
  assert.match(source, /-01-01/);
});

test("I07 – historical_sync accepts optional body.dateFrom", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /body\.dateFrom/);
  assert.match(source, /typeof body\.dateFrom === "string"/);
});

test("I08 – historical_sync returns jobId, dateFrom, dateTo", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /jobId: job\.id/);
  assert.match(source, /dateFrom:/);
  assert.match(source, /dateTo:/);
});

test("I09 – historical_sync sets maxAttempts for retry support", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /maxAttempts: 3/);
});

test("I10 – auto-sync route rejects unknown actions with 400", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /Unknown action/);
  assert.match(source, /400/);
});

test("I11 – historical_sync requires sales_auto_sync feature", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /sales_auto_sync/);
  assert.match(source, /featureEnabled/);
  assert.match(source, /403/);
});

test("I12 – historical_sync uses Ecuador timezone offset", async () => {
  const source = await readFile(autoSyncRoutePath, "utf8");
  assert.match(source, /-05:00/);
});

// ══════════════════════════════════════════════════════════════════════════════
// J. Phase E — Sync Jobs API Route
// ══════════════════════════════════════════════════════════════════════════════

const syncJobsRoutePath = new URL("../../app/api/sales-import/sync-jobs/route.ts", import.meta.url);

test("J01 – sync-jobs route exports GET", async () => {
  const source = await readFile(syncJobsRoutePath, "utf8");
  assert.match(source, /export async function GET/);
});

test("J02 – sync-jobs route requires dashboard session", async () => {
  const source = await readFile(syncJobsRoutePath, "utf8");
  assert.match(source, /requireDashboardSession/);
});

test("J03 – sync-jobs route queries salesSriSyncJob", async () => {
  const source = await readFile(syncJobsRoutePath, "utf8");
  assert.match(source, /salesSriSyncJob\.findMany/);
  assert.match(source, /salesSriSyncJob\.count/);
});

test("J04 – sync-jobs route supports pagination", async () => {
  const source = await readFile(syncJobsRoutePath, "utf8");
  assert.match(source, /page/);
  assert.match(source, /pageSize/);
  assert.match(source, /totalPages/);
});

test("J05 – sync-jobs route orders by createdAt descending", async () => {
  const source = await readFile(syncJobsRoutePath, "utf8");
  assert.match(source, /orderBy[\s\S]*createdAt[\s\S]*desc/);
});

// ══════════════════════════════════════════════════════════════════════════════
// K. Phase E — Sync History Page + Client
// ══════════════════════════════════════════════════════════════════════════════

const syncHistoryPagePath = new URL("../../app/facturacion/sales/imports/sync-history/page.tsx", import.meta.url);
const syncHistoryClientPath = new URL("../../app/facturacion/sales/imports/sync-history/sync-history-client.tsx", import.meta.url);

test("K01 – sync history page uses DashboardShell", async () => {
  const source = await readFile(syncHistoryPagePath, "utf8");
  assert.match(source, /DashboardShell/);
  assert.match(source, /requireDashboardSession/);
});

test("K02 – sync history client is a client component", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /"use client"/);
});

test("K03 – sync history client calls sync-jobs API", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /\/api\/sales-import\/sync-jobs/);
});

test("K04 – sync history client shows job status badges", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /SUCCEEDED/);
  assert.match(source, /FAILED/);
  assert.match(source, /RUNNING/);
  assert.match(source, /QUEUED/);
  assert.match(source, /HUMAN_VERIFICATION_REQUIRED/);
});

test("K05 – sync history client shows document counts", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /documentsFound/);
  assert.match(source, /documentsImported/);
  assert.match(source, /documentsSkipped/);
  assert.match(source, /documentsFailed/);
});

test("K06 – sync history client supports historical sync trigger", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /historical_sync/);
  assert.match(source, /\/api\/sales-import\/auto-sync/);
});

test("K07 – sync history client has pagination", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /Anterior/);
  assert.match(source, /Siguiente/);
  assert.match(source, /totalPages/);
});

// ══════════════════════════════════════════════════════════════════════════════
// L. Phase E — XML Viewer Component
// ══════════════════════════════════════════════════════════════════════════════

const xmlViewerPath = new URL("../../components/appsolux/sri/xml-viewer.tsx", import.meta.url);

test("L01 – XML viewer is a client component", async () => {
  const source = await readFile(xmlViewerPath, "utf8");
  assert.match(source, /"use client"/);
});

test("L02 – XML viewer formats XML with indentation", async () => {
  const source = await readFile(xmlViewerPath, "utf8");
  assert.match(source, /formatXml/);
  assert.match(source, /indent/);
});

test("L03 – XML viewer provides syntax highlighting", async () => {
  const source = await readFile(xmlViewerPath, "utf8");
  assert.match(source, /highlightXml/);
  assert.match(source, /text-rose-600/);
  assert.match(source, /text-emerald-700/);
});

test("L04 – XML viewer has copy to clipboard functionality", async () => {
  const source = await readFile(xmlViewerPath, "utf8");
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /Copiar XML/);
});

test("L05 – XML viewer supports expand/collapse for large XML", async () => {
  const source = await readFile(xmlViewerPath, "utf8");
  assert.match(source, /expanded/);
  assert.match(source, /Mostrar XML completo/);
});

test("L06 – XML viewer shows access key when provided", async () => {
  const source = await readFile(xmlViewerPath, "utf8");
  assert.match(source, /accessKey/);
  assert.match(source, /Clave de acceso/);
});

// ══════════════════════════════════════════════════════════════════════════════
// M. Phase E — Credential Status Badge Component
// ══════════════════════════════════════════════════════════════════════════════

const credentialBadgePath = new URL("../../components/appsolux/sri/credential-status-badge.tsx", import.meta.url);

test("M01 – credential status badge is a client component", async () => {
  const source = await readFile(credentialBadgePath, "utf8");
  assert.match(source, /"use client"/);
});

test("M02 – badge supports all credential statuses", async () => {
  const source = await readFile(credentialBadgePath, "utf8");
  assert.match(source, /VERIFIED/);
  assert.match(source, /PENDING_VERIFICATION/);
  assert.match(source, /INVALID/);
  assert.match(source, /ERROR/);
  assert.match(source, /HUMAN_VERIFICATION_REQUIRED/);
});

test("M03 – badge has differentiated visual styles per status", async () => {
  const source = await readFile(credentialBadgePath, "utf8");
  assert.match(source, /bg-emerald-100/);
  assert.match(source, /bg-red-100/);
  assert.match(source, /bg-yellow-100/);
  assert.match(source, /bg-blue-100/);
});

test("M04 – badge provides descriptive tooltips", async () => {
  const source = await readFile(credentialBadgePath, "utf8");
  assert.match(source, /title=\{config\.description\}/);
});

test("M05 – badge supports size variants", async () => {
  const source = await readFile(credentialBadgePath, "utf8");
  assert.match(source, /size[\s\S]*"sm"[\s\S]*"md"/);
});

test("M06 – CredentialStatusDetail provides expanded status view", async () => {
  const source = await readFile(credentialBadgePath, "utf8");
  assert.match(source, /export function CredentialStatusDetail/);
  assert.match(source, /description/);
});

// ══════════════════════════════════════════════════════════════════════════════
// N. Phase E — XML API Route for Imported Documents
// ══════════════════════════════════════════════════════════════════════════════

const xmlApiRoutePath = new URL("../../app/api/sales-import/documents/[documentId]/xml/route.ts", import.meta.url);

test("N01 – XML API route exports GET", async () => {
  const source = await readFile(xmlApiRoutePath, "utf8");
  assert.match(source, /export async function GET/);
});

test("N02 – XML API route requires dashboard session", async () => {
  const source = await readFile(xmlApiRoutePath, "utf8");
  assert.match(source, /requireDashboardSession/);
});

test("N03 – XML API route queries externalSalesDocument", async () => {
  const source = await readFile(xmlApiRoutePath, "utf8");
  assert.match(source, /externalSalesDocument\.findFirst/);
  assert.match(source, /tenantId: tenant\.id/);
});

test("N04 – XML API route extracts XML from rawPayload", async () => {
  const source = await readFile(xmlApiRoutePath, "utf8");
  assert.match(source, /rawPayload/);
  assert.match(source, /payload\.xml/);
});

test("N05 – XML API route returns 404 when XML not available", async () => {
  const source = await readFile(xmlApiRoutePath, "utf8");
  assert.match(source, /XML no disponible/);
  assert.match(source, /404/);
});

// ══════════════════════════════════════════════════════════════════════════════
// O. Phase E — Navigation Updates
// ══════════════════════════════════════════════════════════════════════════════

test("O01 – automatic sales screen preserves a separate history link", async () => {
  const source = await readFile("app/facturacion/sales/imports/sales-import-client.tsx", "utf8");
  assert.match(source, /sync-history/);
  assert.match(source, /Consultar historial/);
});

// ══════════════════════════════════════════════════════════════════════════════
// P. Fix — TXT Import Limit + Windows-1252 Encoding
// ══════════════════════════════════════════════════════════════════════════════

test("P01 – TXT import limit is 50 or less", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  const match = source.match(/MAX_ROWS_PER_IMPORT\s*=\s*(\d+)/);
  assert.ok(match, "MAX_ROWS_PER_IMPORT not found");
  const limit = Number(match![1]);
  assert.ok(limit <= 50, `Limit is ${limit}, expected <= 50`);
});

test("P02 – TXT import route handles Windows-1252 encoding", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /windows-1252/);
});

test("P03 – TXT import route uses TextDecoder with fatal for UTF-8", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /fatal:\s*true/);
});

test("P04 – TXT import route reads arrayBuffer for charset detection", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.match(source, /arrayBuffer/);
});

test("P05 – TXT import client communicates the 50-document limit", async () => {
  const source = await readFile(txtImportClientPath, "utf8");
  assert.match(source, /50/);
  assert.match(source, /divíd/);
});

test("P06 – TXT parser splits tab-separated columns including special chars", async () => {
  const source = await readFile(txtParserPath, "utf8");
  assert.ok(source.includes("split(\"\\t\")"), "Parser must split on tab characters");
  assert.ok(source.includes("RAZON_SOCIAL_EMISOR"), "Parser must detect emitter name column");
});

test("P07 – TXT import route falls back to Windows-1252 on UTF-8 failure", async () => {
  const source = await readFile(txtImportRoutePath, "utf8");
  assert.ok(source.includes("utf-8"), "Must try UTF-8 first");
  assert.ok(source.includes("windows-1252"), "Must fall back to Windows-1252");
  const utf8Idx = source.indexOf("utf-8");
  const latin1Idx = source.indexOf("windows-1252");
  assert.ok(utf8Idx < latin1Idx, "UTF-8 must be tried before Windows-1252");
});

// ══════════════════════════════════════════════════════════════════════════════
// Q. Fix — Sync Job Checkpoint Column
// ══════════════════════════════════════════════════════════════════════════════

const prismaSchemaPath = new URL("../../prisma/schema.prisma", import.meta.url);
const migrationSqlPath = new URL("../../prisma/migrations/20261031400000_add_sync_job_checkpoint/migration.sql", import.meta.url);

test("Q01 – Prisma schema has checkpointDate on SalesSriSyncJob", async () => {
  const source = await readFile(prismaSchemaPath, "utf8");
  assert.match(source, /checkpointDate\s+DateTime\?/);
});

test("Q02 – Migration file exists for checkpointDate", async () => {
  const { stat } = await import("node:fs/promises");
  const s = await stat(migrationSqlPath);
  assert.ok(s.isFile());
});

test("Q03 – Migration adds checkpointDate column", async () => {
  const source = await readFile(migrationSqlPath, "utf8");
  assert.match(source, /checkpointDate/);
  assert.match(source, /SalesSriSyncJob/);
});

test("Q04 – Sync jobs API includes checkpointDate in select", async () => {
  const source = await readFile(syncJobsRoutePath, "utf8");
  assert.match(source, /checkpointDate:\s*true/);
});

test("Q05 – Sync history client has checkpointDate in SyncJob type", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /checkpointDate/);
});

test("Q06 – Sync history client shows checkpoint progress", async () => {
  const source = await readFile(syncHistoryClientPath, "utf8");
  assert.match(source, /Progreso/);
});
