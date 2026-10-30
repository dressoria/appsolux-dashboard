import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adapterPath = new URL("./sales-sync-adapter.ts", import.meta.url);
const hmacPath = new URL("./sales-sync-hmac.ts", import.meta.url);
const xmlImportPath = new URL("./sales-xml-import.ts", import.meta.url);
const importRoutePath = new URL("../../app/api/internal/sales/sri-sync/import-xml/route.ts", import.meta.url);
const schemaPath = new URL("../../prisma/schema.prisma", import.meta.url);

// ══════════════════════════════════════════════════════════════════════════════
// A. Sales XML Import Parser
// ══════════════════════════════════════════════════════════════════════════════

test("A01 – parseSalesXml function exists", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /export function parseSalesXml/);
});

test("A02 – parseSalesXml extracts accessKey from infoTributaria", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /claveAcceso/);
  assert.match(source, /infoTributaria/);
});

test("A03 – parseSalesXml extracts ruc from infoTributaria", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /rucEmitter/);
  assert.match(source, /extractTag.*infoTributaria.*ruc/);
});

test("A04 – parseSalesXml maps codDoc to document types", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /codDoc === "01".*INVOICE/);
  assert.match(source, /codDoc === "04".*CREDIT_NOTE/);
  assert.match(source, /codDoc === "05".*DEBIT_NOTE/);
});

test("A05 – parseSalesXml extracts customer info", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /identificacionComprador/);
  assert.match(source, /razonSocialComprador/);
});

test("A06 – parseSalesXml extracts items from detalles", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /extractAllBlocks.*detalle/);
  assert.match(source, /codigoPrincipal/);
  assert.match(source, /precioUnitario/);
});

test("A07 – parseSalesXml handles infoNotaCredito and infoNotaDebito", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /infoNotaCredito/);
  assert.match(source, /infoNotaDebito/);
});

// ══════════════════════════════════════════════════════════════════════════════
// B. Sales XML Import Deduplication
// ══════════════════════════════════════════════════════════════════════════════

test("B01 – importSalesXml checks accessKey uniqueness", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /externalSalesDocument\.findFirst/);
  assert.match(source, /accessKey/);
  assert.match(source, /ya está registrado/);
});

test("B02 – importSalesXml checks documentNumber uniqueness", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /documentType.*documentNumber/);
});

test("B03 – importSalesXml checks against native SriDocument", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /sriDocument\.findFirst/);
  assert.match(source, /documento nativo/);
});

test("B04 – importSalesXml validates issuer RUC matches tenant", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /expectedIssuerRuc/);
  assert.match(source, /rucEmitter.*!==.*expectedIssuerRuc/);
  assert.match(source, /no corresponde/);
});

// ══════════════════════════════════════════════════════════════════════════════
// C. Sales XML Import creates ExternalSalesDocument
// ══════════════════════════════════════════════════════════════════════════════

test("C01 – importSalesXml creates ExternalSalesDocument with source SRI_FACTURADOR", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /externalSalesDocument\.create/);
  assert.match(source, /source: "SRI_FACTURADOR"/);
});

test("C02 – importSalesXml creates items", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /items:.*create.*itemsData/);
});

test("C03 – importSalesXml stores rawPayload (capped XML)", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /rawPayload.*xml.*xmlContent\.slice/);
});

test("C04 – importSalesXml returns ok true with externalDocumentId", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.match(source, /ok: true.*externalDocumentId.*doc\.id/);
});

// ══════════════════════════════════════════════════════════════════════════════
// D. Internal API Route
// ══════════════════════════════════════════════════════════════════════════════

test("D01 – Internal API validates HMAC signature", async () => {
  const source = await readFile(importRoutePath, "utf8");
  assert.match(source, /validateHmacRequest/);
  assert.match(source, /403/);
});

test("D02 – Internal API verifies job is RUNNING", async () => {
  const source = await readFile(importRoutePath, "utf8");
  assert.match(source, /salesSriSyncJob\.findFirst/);
  assert.match(source, /status: "RUNNING"/);
});

test("D03 – Internal API verifies job tenant matches header tenant", async () => {
  const source = await readFile(importRoutePath, "utf8");
  assert.match(source, /job\.tenantId !== tenantId/);
});

test("D04 – Internal API resolves tenant RUC for issuer validation", async () => {
  const source = await readFile(importRoutePath, "utf8");
  assert.match(source, /taxIdentificationNormalized/);
});

test("D05 – Internal API returns IMPORTED/ALREADY_EXISTS/WRONG_ISSUER/INVALID", async () => {
  const source = await readFile(importRoutePath, "utf8");
  assert.match(source, /IMPORTED/);
  assert.match(source, /ALREADY_EXISTS/);
  assert.match(source, /WRONG_ISSUER/);
  assert.match(source, /INVALID/);
});

test("D06 – Internal API does NOT accept tenantId freely from worker", async () => {
  const source = await readFile(importRoutePath, "utf8");
  assert.match(source, /job\.tenantId !== tenantId/);
});

// ══════════════════════════════════════════════════════════════════════════════
// E. Sales Sync HMAC
// ══════════════════════════════════════════════════════════════════════════════

test("E01 – HMAC uses SALES_SYNC_INTERNAL_SECRET", async () => {
  const source = await readFile(hmacPath, "utf8");
  assert.match(source, /SALES_SYNC_INTERNAL_SECRET/);
});

test("E02 – HMAC validates timestamp age", async () => {
  const source = await readFile(hmacPath, "utf8");
  assert.match(source, /MAX_TIMESTAMP_AGE_MS/);
  assert.match(source, /Timestamp too old/);
});

test("E03 – HMAC uses constant-time comparison", async () => {
  const source = await readFile(hmacPath, "utf8");
  assert.match(source, /diff \|=/);
});

// ══════════════════════════════════════════════════════════════════════════════
// F. Sales Sync Adapter
// ══════════════════════════════════════════════════════════════════════════════

test("F01 – SriSalesSourceAdapter takes tenantId", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /constructor.*private tenantId: string/);
});

test("F02 – verifyConnection checks PurchaseSriCredential status", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /purchaseSriCredential\.findUnique/);
  assert.match(source, /VERIFIED/);
  assert.match(source, /HUMAN_VERIFICATION_REQUIRED/);
  assert.match(source, /INVALID/);
});

test("F03 – syncIssuedDocuments delegates to worker", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /worker SRI de ventas/);
});

test("F04 – downloadXml delegates to worker", async () => {
  const source = await readFile(adapterPath, "utf8");
  assert.match(source, /worker SRI de ventas/);
});

// ══════════════════════════════════════════════════════════════════════════════
// G. Schema contracts
// ══════════════════════════════════════════════════════════════════════════════

test("G01 – SalesSriSyncJobType has VERIFY_CONNECTION and SYNC_ISSUED_DOCUMENTS", async () => {
  const source = await readFile(schemaPath, "utf8");
  const enumBlock = source.match(/enum SalesSriSyncJobType\s*\{([\s\S]*?)\}/);
  assert.ok(enumBlock);
  assert.match(enumBlock![1], /VERIFY_CONNECTION/);
  assert.match(enumBlock![1], /SYNC_ISSUED_DOCUMENTS/);
});

test("G02 – SalesSriSyncJobStatus has all required statuses", async () => {
  const source = await readFile(schemaPath, "utf8");
  const enumBlock = source.match(/enum SalesSriSyncJobStatus\s*\{([\s\S]*?)\}/);
  assert.ok(enumBlock);
  for (const status of ["QUEUED", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED", "HUMAN_VERIFICATION_REQUIRED"]) {
    assert.match(enumBlock![1], new RegExp(status));
  }
});

test("G03 – SalesSriSyncJob has job tracking fields", async () => {
  const source = await readFile(schemaPath, "utf8");
  const jobBlock = source.match(/model SalesSriSyncJob\s*\{([\s\S]*?)\n\}/);
  assert.ok(jobBlock);
  for (const field of ["lockedAt", "lockedBy", "startedAt", "finishedAt", "durationMs", "attemptCount", "maxAttempts"]) {
    assert.match(jobBlock![1], new RegExp(field));
  }
});

test("G04 – SalesSriSyncJob has document counters", async () => {
  const source = await readFile(schemaPath, "utf8");
  const jobBlock = source.match(/model SalesSriSyncJob\s*\{([\s\S]*?)\n\}/);
  assert.ok(jobBlock);
  for (const field of ["documentsFound", "documentsImported", "documentsSkipped", "documentsFailed"]) {
    assert.match(jobBlock![1], new RegExp(field));
  }
});

test("G05 – ExternalSalesDocument has SRI_FACTURADOR source", async () => {
  const source = await readFile(schemaPath, "utf8");
  assert.match(source, /SRI_FACTURADOR/);
});

test("G06 – ExternalSalesDocument has unique accessKey per tenant", async () => {
  const source = await readFile(schemaPath, "utf8");
  assert.match(source, /@@unique\(\[tenantId, accessKey\]\)/);
});

// ══════════════════════════════════════════════════════════════════════════════
// H. No side effects on import
// ══════════════════════════════════════════════════════════════════════════════

test("H01 – importSalesXml does NOT create stock movements", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.doesNotMatch(source, /stockMovement/i);
  assert.doesNotMatch(source, /inventory/i);
});

test("H02 – importSalesXml does NOT create accounting entries", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.doesNotMatch(source, /accountingEntry/i);
  assert.doesNotMatch(source, /journalEntry/i);
});

test("H03 – importSalesXml does NOT create cash/bank movements", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.doesNotMatch(source, /cashMovement/i);
  assert.doesNotMatch(source, /bankTransaction/i);
});

test("H04 – importSalesXml does NOT create invoices or submit to SRI", async () => {
  const source = await readFile(xmlImportPath, "utf8");
  assert.doesNotMatch(source, /sriDocument\.create/);
  assert.doesNotMatch(source, /sriSubmission/i);
  assert.doesNotMatch(source, /sequentialNumber/);
});
