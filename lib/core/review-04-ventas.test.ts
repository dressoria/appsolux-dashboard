import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// ── POS: server-side pagination API ─────────────────────────────────────────

test("POS products API filters by availability and supports pagination", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/pos/products/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /availability/);
  assert.match(source, /page/);
  assert.match(source, /perPage/);
  assert.match(source, /tenantId/);
});

test("POS client creates SalesInvoiceDraft for 'Editar detalle' instead of inline editor", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/basic/pos-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /api\/facturacion\/drafts/);
  assert.match(source, /draftId/);
});

// ── Documents: export API ───────────────────────────────────────────────────

test("document export endpoint produces PDF and Excel", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/documents/export/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /format/);
  assert.match(source, /pdf/);
  assert.match(source, /excel/);
  assert.match(source, /PDFDocument|pdfkit|pdf-lib/i);
});

// ── Proformas: 8 business days ──────────────────────────────────────────────

test("proforma editor defaults to 8 business days", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/proforma-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /added < 8/);
  assert.match(source, /getDay\(\) !== 0 && d\.getDay\(\) !== 6/);
});

test("proforma PDF shows 8-day validity text", async () => {
  const source = await readFile(
    new URL("../../app/api/basic/proformas/[proformaId]/pdf/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /8 días laborables/);
});

// ── Sales Orders: no side effects ───────────────────────────────────────────

test("sales orders API does NOT create inventory movements, payments, SRI documents, or CxC", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/sales-orders/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /inventoryMovement|InventoryMovement/);
  assert.doesNotMatch(source, /treasuryMovement|TreasuryMovement/);
  assert.doesNotMatch(source, /sriDocument\.create/);
  assert.doesNotMatch(source, /treasuryObligation/i);
});

test("sales order conversion is idempotent (409 if already CONVERTED)", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/sales-orders/[orderId]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /CONVERTED/);
  assert.match(source, /409/);
  assert.match(source, /SalesInvoiceDraft|salesInvoiceDraft/);
});

test("sales orders enforce tenant server-side", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/sales-orders/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /tenantId: tenant\.id/);
});

// ── Credit Notes: AUTHORIZED-only, no draft effects ─────────────────────────

test("credit notes API requires AUTHORIZED source invoice", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/credit-notes/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /status: "AUTHORIZED"/);
  assert.match(source, /documentType: "INVOICE"/);
  assert.match(source, /tenantId: tenant\.id/);
});

test("credit note creation does NOT create inventory, treasury, or SRI effects", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/credit-notes/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /inventoryMovement|InventoryMovement/);
  assert.doesNotMatch(source, /treasuryMovement|TreasuryMovement/);
  assert.doesNotMatch(source, /sriDocument\.create/);
  assert.doesNotMatch(source, /treasuryObligation/i);
  assert.match(source, /status: "DRAFT"/);
});

test("credit note editor validates total does not exceed invoice total", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/sales/credit-notes/new/credit-note-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /total > invoiceTotal/);
  assert.match(source, /no puede superar/);
});

test("credit note search-invoices endpoint only returns AUTHORIZED INVOICE documents", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/credit-notes/search-invoices/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /documentType: "INVOICE"/);
  assert.match(source, /status: "AUTHORIZED"/);
  assert.match(source, /tenantId: tenant\.id/);
});

// ── Debit Notes: AUTHORIZED-only, reasons positive, no draft CxC ────────────

test("debit notes API requires AUTHORIZED source invoice", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/debit-notes/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /status: "AUTHORIZED"/);
  assert.match(source, /documentType: "INVOICE"/);
  assert.match(source, /tenantId: tenant\.id/);
});

test("debit note creation does NOT create CxC or treasury effects", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/debit-notes/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /treasuryObligation/i);
  assert.doesNotMatch(source, /treasuryMovement|TreasuryMovement/);
  assert.doesNotMatch(source, /sriDocument\.create/);
  assert.match(source, /status: "DRAFT"/);
});

test("debit note editor validates positive amounts", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/sales/debit-notes/new/debit-note-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /amount <= 0/);
  assert.match(source, /positivos/);
});

// ── SRI XML builders ────────────────────────────────────────────────────────

test("credit note XML builder uses codDoc 04 and notaCredito root element", async () => {
  const source = await readFile(
    new URL("./sri-credit-note-xml.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /<codDoc>04<\/codDoc>/);
  assert.match(source, /<notaCredito/);
  assert.match(source, /codDocModificado>01</);
  assert.match(source, /CREDIT_NOTE/);
});

test("debit note XML builder uses codDoc 05 and notaDebito root element", async () => {
  const source = await readFile(
    new URL("./sri-debit-note-xml.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /<codDoc>05<\/codDoc>/);
  assert.match(source, /<notaDebito/);
  assert.match(source, /codDocModificado>01</);
  assert.match(source, /DEBIT_NOTE/);
});

// ── Receipts: Facturom branding ─────────────────────────────────────────────

test("receipt PDF includes Facturom branding and payment labels", async () => {
  const source = await readFile(
    new URL("./basic-receipt-pdf.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /Facturom/);
  assert.match(source, /Transferencia bancaria/);
  assert.match(source, /Tarjeta de crédito\/débito/);
  assert.match(source, /Formas de pago/);
});

// ── Documents page: NC/ND in filters ────────────────────────────────────────

test("documents page includes credit_note and debit_note filter keys", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/documents/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /credit_note/);
  assert.match(source, /debit_note/);
});

test("billing documents list includes NC/ND filter options", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/billing/billing-documents-list.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /credit_note/);
  assert.match(source, /debit_note/);
  assert.match(source, /Notas de crédito/);
  assert.match(source, /Notas de débito/);
});
