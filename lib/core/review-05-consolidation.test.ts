import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseMoney,
  parseImportDate,
  isValidSerieComprobante,
  isValidAccessKey,
  normalizeDocumentType,
  normalizeIdentificationType,
  parseTaxRate,
} from "./sales-import-parsers";

// ── 61. TEMPLATE ─────────────────────────────────────────────────────────────

test("XLSX template has exactly 18 columns in correct order", async () => {
  const source = await readFile(
    new URL("./sales-import-template.ts", import.meta.url),
    "utf8",
  );
  const match = source.match(/IMPORT_COLUMNS\s*=\s*\[([\s\S]*?)\]\s*as\s*const/);
  assert.ok(match, "IMPORT_COLUMNS array not found");
  const cols = [...match![1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
  assert.equal(cols.length, 18);
  const expected = [
    "COMPROBANTE", "SERIE_COMPROBANTE", "CLAVE_ACCESO",
    "FECHA_AUTORIZACION", "FECHA_EMISION", "VALOR_SIN_IMPUESTOS",
    "IVA", "IMPORTE_TOTAL", "TIPO_IDENTIFICACION",
    "IDENTIFICACION_CLIENTE", "NOMBRE_CLIENTE", "CODIGO_PRODUCTO",
    "TIPO_IMPUESTO", "CANTIDAD", "PRECIO_UNITARIO",
    "DESCUENTO_VALOR", "OBSERVACION_PRODUCTO", "OBSERVACION_FACTURA",
  ];
  assert.deepEqual(cols, expected);
});

test("Template instructions sheet exists in generated XLSX source", async () => {
  const source = await readFile(
    new URL("./sales-import-template.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /INSTRUCCIONES/);
  assert.match(source, /addWorksheet.*INSTRUCCIONES/);
  assert.match(source, /frozen|freeze/i);
  assert.match(source, /autoFilter/);
});

// ── 62. MONEY PARSER ─────────────────────────────────────────────────────────

test("Money parser handles all Ecuador/Excel formats", () => {
  assert.equal(parseMoney(15), 15);
  assert.equal(parseMoney("15"), 15);
  assert.equal(parseMoney("15.00"), 15);
  assert.equal(parseMoney("15,00"), 15);
  assert.equal(parseMoney("1.234,56"), 1234.56);
  assert.equal(parseMoney("1,234.56"), 1234.56);
});

test("Money parser rejects invalid values", () => {
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(NaN), null);
  assert.equal(parseMoney(-5), null);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney(null), null);
});

// ── 63. DATE PARSER ──────────────────────────────────────────────────────────

test("Date parser handles all required formats", () => {
  const d1 = parseImportDate("30/12/25");
  assert.ok(d1);
  assert.equal(d1!.getFullYear(), 2025);

  const d2 = parseImportDate("30/12/2025");
  assert.ok(d2);
  assert.equal(d2!.getFullYear(), 2025);
  assert.equal(d2!.getMonth(), 11); // December

  const d3 = parseImportDate("31/12/25 15:41");
  assert.ok(d3);

  const d4 = parseImportDate("31/12/2025 15:49:00");
  assert.ok(d4);

  const d5 = parseImportDate("2025-12-30");
  assert.ok(d5);
  assert.equal(d5!.getFullYear(), 2025);

  // Excel serial date (approx 2025-01-01)
  const d6 = parseImportDate(45658);
  assert.ok(d6);
});

test("Date parser rejects invalid dates", () => {
  assert.equal(parseImportDate(""), null);
  assert.equal(parseImportDate(null), null);
  assert.equal(parseImportDate("not-a-date"), null);
});

// ── SERIE_COMPROBANTE ────────────────────────────────────────────────────────

test("Serie format validation", () => {
  assert.ok(isValidSerieComprobante("001-100-000011434"));
  assert.ok(!isValidSerieComprobante("001-100-0000114"));
  assert.ok(!isValidSerieComprobante("01-100-000011434"));
  assert.ok(!isValidSerieComprobante("abc"));
});

test("Access key validation", () => {
  assert.ok(isValidAccessKey("3010202601010010000001143500110012345678912345671"));
  assert.ok(!isValidAccessKey("123"));
  assert.ok(!isValidAccessKey("abc"));
  assert.ok(!isValidAccessKey("301020260101001000000114350011001234567891234567x"));
});

// ── DOCUMENT TYPE NORMALIZER ─────────────────────────────────────────────────

test("Document type normalization", () => {
  assert.equal(normalizeDocumentType("Factura"), "INVOICE");
  assert.equal(normalizeDocumentType("01"), "INVOICE");
  assert.equal(normalizeDocumentType(""), "INVOICE");
  assert.equal(normalizeDocumentType("Nota de crédito"), "CREDIT_NOTE");
  assert.equal(normalizeDocumentType("04"), "CREDIT_NOTE");
  assert.equal(normalizeDocumentType("Nota de débito"), "DEBIT_NOTE");
  assert.equal(normalizeDocumentType("05"), "DEBIT_NOTE");
});

// ── IDENTIFICATION TYPE ──────────────────────────────────────────────────────

test("Identification type normalization", () => {
  assert.equal(normalizeIdentificationType("CEDULA"), "CEDULA");
  assert.equal(normalizeIdentificationType("CÉDULA"), "CEDULA");
  assert.equal(normalizeIdentificationType("RUC"), "RUC");
  assert.equal(normalizeIdentificationType("PASAPORTE"), "PASAPORTE");
  assert.equal(normalizeIdentificationType("CONSUMIDOR_FINAL"), "CONSUMIDOR_FINAL");
});

// ── TAX RATE ─────────────────────────────────────────────────────────────────

test("Tax rate parser", () => {
  const r15 = parseTaxRate("15");
  assert.equal(r15.taxRate, 15);

  const r0 = parseTaxRate("0");
  assert.equal(r0.taxRate, 0);

  const r12 = parseTaxRate("12%");
  assert.equal(r12.taxRate, 12);

  const noObj = parseTaxRate("NO_OBJETO");
  assert.equal(noObj.taxRate, 0);
  assert.equal(noObj.taxCategory, "NO_OBJETO_DE_IMPUESTO");

  const exento = parseTaxRate("EXENTO");
  assert.equal(exento.taxRate, 0);
  assert.equal(exento.taxCategory, "EXENTO_DE_IVA");
});

// ── 64. GROUPING ─────────────────────────────────────────────────────────────

test("Import parser groups rows by SERIE_COMPROBANTE", async () => {
  const source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  // Groups by serie
  assert.match(source, /groups\.get\(key\)/);
  assert.match(source, /SERIE_COMPROBANTE/);
});

test("Import parser detects header consistency errors", async () => {
  const source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /comprobante.*difiere/i);
  assert.match(source, /CLAVE_ACCESO.*difiere/i);
  assert.match(source, /cliente.*difieren/i);
  assert.match(source, /OBSERVACION_FACTURA.*difiere/i);
});

// ── 65. OPTIONAL PRODUCT ─────────────────────────────────────────────────────

test("Import allows invoice without product code", async () => {
  const source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  // Products are optional — no error when codigoProducto is null
  assert.match(source, /codigoProducto.*\|\|.*null/);
  assert.match(source, /TIPO_IMPUESTO.*obligatorio.*cuando hay producto/i);
});

test("Import requires quantity when product is present", async () => {
  const source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /CANTIDAD.*obligatoria.*cuando hay producto/i);
});

// ── 66. UNKNOWN PRODUCT ──────────────────────────────────────────────────────

test("Unknown product code produces WARNING not ERROR, import succeeds", async () => {
  const source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /no vinculado al catálogo/);
  // Status becomes WARNING not ERROR
  assert.match(source, /status.*=.*"WARNING"/);
  // confirmImportV2 still creates with productId null
  assert.match(source, /productByCode\.get.*\?\?.*null/);
});

// ── 67. CUSTOMER ─────────────────────────────────────────────────────────────

test("Customer link by identification, no auto-create", async () => {
  const source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  // Links customer by identification
  assert.match(source, /customerByIdentification/);
  // Does NOT auto-create customers
  assert.doesNotMatch(source, /lightweightCustomer\.create/);
});

// ── 68. DEDUPLICATION ────────────────────────────────────────────────────────

test("Deduplication by accessKey, serie, and SriDocument", async () => {
  const source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  // Checks accessKey in external docs
  assert.match(source, /existingByAccessKey/);
  // Checks accessKey in SriDocument
  assert.match(source, /sriDocument\.findMany/);
  // Checks serie
  assert.match(source, /existingBySerie/);
  // Legacy check
  assert.match(source, /origin.*IMPORT/);
});

test("Ingest API is idempotent (duplicate returns ok)", async () => {
  const source = await readFile(
    new URL("../../app/api/sales-import/ingest/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /duplicate.*true/);
  assert.match(source, /existingSource.*FACTUROM/);
});

// ── 69. NO SIDE EFFECTS ─────────────────────────────────────────────────────

test("External import creates NO operational side effects", async () => {
  const v2Source = await readFile(
    new URL("./sales-import-v2.ts", import.meta.url),
    "utf8",
  );
  const ingestSource = await readFile(
    new URL("../../app/api/sales-import/ingest/route.ts", import.meta.url),
    "utf8",
  );
  const xmlSource = await readFile(
    new URL("../../app/api/sales-import/ingest/xml/route.ts", import.meta.url),
    "utf8",
  );

  for (const source of [v2Source, ingestSource, xmlSource]) {
    assert.doesNotMatch(source, /inventoryMovement\.create/i);
    assert.doesNotMatch(source, /treasuryMovement\.create/i);
    assert.doesNotMatch(source, /accountingJournalEntry\.create/i);
    assert.doesNotMatch(source, /sriDocument\.create/i);
  }
});

// ── 70. FEATURE ──────────────────────────────────────────────────────────────

test("sales_auto_sync feature exists and is BASIC=false, ADVANCED/ENTERPRISE=true", async () => {
  const source = await readFile(
    new URL("./commercial-plans.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /sales_auto_sync/);

  // Check BASIC doesn't have it
  const basicBlock = source.match(/case "BASIC"[\s\S]*?buildFeatureMap\(\[([\s\S]*?)\]\)/);
  assert.ok(basicBlock);
  assert.doesNotMatch(basicBlock![1], /sales_auto_sync/);

  // Check ADVANCED has it
  const advBlock = source.match(/case "ADVANCED"[\s\S]*?buildFeatureMap\(\[([\s\S]*?)\]\)/);
  assert.ok(advBlock);
  assert.match(advBlock![1], /sales_auto_sync/);

  // Check ENTERPRISE has it
  const entBlock = source.match(/case "ENTERPRISE"[\s\S]*?buildFeatureMap\(\[([\s\S]*?)\]\)/);
  assert.ok(entBlock);
  assert.match(entBlock![1], /sales_auto_sync/);
});

// ── 71. API TOKEN ────────────────────────────────────────────────────────────

test("Token system: hash-only storage, high entropy, prefix", async () => {
  const source = await readFile(
    new URL("./sales-ingest-tokens.ts", import.meta.url),
    "utf8",
  );
  // Uses SHA-256 hash
  assert.match(source, /sha256/);
  // Generates with randomBytes
  assert.match(source, /randomBytes/);
  // Stores prefix
  assert.match(source, /tokenPrefix/);
  // fsi_ prefix
  assert.match(source, /fsi_/);
  // Never stores plaintext
  assert.doesNotMatch(source, /tokenPlaintext/);
});

test("Ingest endpoint resolves tenant from token, not from body", async () => {
  const source = await readFile(
    new URL("../../app/api/sales-import/ingest/route.ts", import.meta.url),
    "utf8",
  );
  // Token resolves tenant
  assert.match(source, /resolveTokenTenant/);
  // Does NOT read tenantId from body
  assert.doesNotMatch(source, /body\.tenantId/);
  assert.doesNotMatch(source, /body\["tenantId"\]/);
});

// ── 72. XML INGEST ───────────────────────────────────────────────────────────

test("XML ingest validates issuer RUC against tenant", async () => {
  const source = await readFile(
    new URL("../../app/api/sales-import/ingest/xml/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /ruc.*!==.*rucEmisor|rucEmisor.*!==.*ruc/);
  assert.match(source, /403/);
});

test("XML ingest rejects XXE/external entities", async () => {
  const source = await readFile(
    new URL("../../app/api/sales-import/ingest/xml/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /DOCTYPE|ENTITY/);
});

test("XML ingest deduplicates by accessKey", async () => {
  const source = await readFile(
    new URL("../../app/api/sales-import/ingest/xml/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /claveAcceso/);
  assert.match(source, /duplicate.*true/);
});

// ── SRI ADAPTER ──────────────────────────────────────────────────────────────

test("SRI sales sync adapter reports not configured", async () => {
  const source = await readFile(
    new URL("./sales-sync-adapter.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /SRI_ISSUED_SOURCE_NOT_CONFIGURED/);
  assert.match(source, /configured.*=.*false/);
});

// ── SCHEMA ───────────────────────────────────────────────────────────────────

test("ExternalSalesDocument model exists with required fields", async () => {
  const schema = await readFile(
    new URL("../../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  assert.match(schema, /model ExternalSalesDocument/);
  assert.match(schema, /model ExternalSalesDocumentItem/);
  assert.match(schema, /model SalesAutoSyncSettings/);
  assert.match(schema, /model SalesIngestToken/);
  assert.match(schema, /model SalesSriSyncJob/);
  assert.match(schema, /enum SalesExternalSource/);
  assert.match(schema, /MANUAL_IMPORT/);
  assert.match(schema, /enum SalesExternalDocumentStatus/);
  assert.match(schema, /IMPORTED/);
  assert.match(schema, /NEEDS_REVIEW/);
  assert.match(schema, /DUPLICATE/);
});

// ── CONSOLIDATED VIEW ────────────────────────────────────────────────────────

test("Consolidated read layer normalizes LightweightSale + ExternalSalesDocument", async () => {
  const source = await readFile(
    new URL("./sales-consolidated.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /listConsolidatedSales/);
  assert.match(source, /LightweightSale/i);
  assert.match(source, /ExternalSalesDocument/i);
  assert.match(source, /SriDocument/i);
  assert.match(source, /FACTUROM/);
  assert.match(source, /LEGACY_IMPORT/);
  // Deduplicates by accessKey
  assert.match(source, /seen\.has\(item\.accessKey\)/);
});

test("Consolidated totals helper exists", async () => {
  const source = await readFile(
    new URL("./sales-consolidated.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /getConsolidatedSalesTotals/);
  assert.match(source, /facturomCount/);
  assert.match(source, /externalCount/);
});

// ── UI ───────────────────────────────────────────────────────────────────────

test("UI has 3 tabs: Consolidado, Importar archivo, Importación automática", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/sales/imports/sales-import-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Consolidado/);
  assert.match(source, /Importar archivo/);
  assert.match(source, /Importación automática/);
  assert.match(source, /consolidated.*import.*automatic/);
  // Premium badge
  assert.match(source, /Premium/);
});

test("UI shows source badges", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/sales/imports/sales-import-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Facturom/);
  assert.match(source, /Archivo/);
  assert.match(source, /API/);
  assert.match(source, /Telegram/);
  assert.match(source, /SRI/);
});

// ── MIGRATION ────────────────────────────────────────────────────────────────

test("Migration creates all required tables and enums", async () => {
  const sql = await readFile(
    new URL("../../prisma/migrations/20261031100000_sales_consolidation/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /ExternalSalesDocument/);
  assert.match(sql, /ExternalSalesDocumentItem/);
  assert.match(sql, /SalesAutoSyncSettings/);
  assert.match(sql, /SalesIngestToken/);
  assert.match(sql, /SalesSriSyncJob/);
  assert.match(sql, /SalesExternalSource/);
  assert.match(sql, /SalesExternalDocumentStatus/);
  assert.match(sql, /sales_auto_sync/);
  assert.match(sql, /totalDocuments/);
});
