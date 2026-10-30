import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// ── A-H: HomeTabs ────────────────────────────────────────────────────────────

test("Home page renders HomeTabs with two tabs", async () => {
  const page = await readFile(
    new URL("../../app/facturacion/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /HomeTabs/);
  const tabs = await readFile(
    new URL("../../components/appsolux/facturacion/home-tabs.tsx", import.meta.url),
    "utf8",
  );
  assert.match(tabs, /Accesos directos/);
  assert.match(tabs, /Resumen y estadísticas/);
});

test("Home page has welcome banner with gradient", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /0D3B8F/);
  assert.match(source, /1E52F1/);
  assert.match(source, /Bienvenido/);
});

test("Home page has compact KPI metrics", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /KpiMetric/);
  assert.match(source, /Ventas del día/);
  assert.match(source, /Facturado este mes/);
});

test("Home page chart uses 50/50 grid", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /xl:grid-cols-2/);
});

// ── I-K: Ecuador locations ───────────────────────────────────────────────────

test("Ecuador locations has exactly 24 provinces", async () => {
  const source = await readFile(
    new URL("./ecuador-locations.ts", import.meta.url),
    "utf8",
  );
  const provinceMatches = source.match(/name: "[A-ZÁÉÍÓÚÑ][^"]*",\s*\n\s*cantons:/g);
  assert.ok(provinceMatches);
  assert.equal(provinceMatches!.length, 24, `Expected 24 provinces, got ${provinceMatches!.length}`);
});

test("All 24 province names present in locations", async () => {
  const source = await readFile(
    new URL("./ecuador-locations.ts", import.meta.url),
    "utf8",
  );
  const required = [
    "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
    "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
    "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza",
    "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas", "Sucumbíos",
    "Tungurahua", "Zamora Chinchipe",
  ];
  for (const name of required) {
    assert.match(source, new RegExp(`name: "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `Missing province: ${name}`);
  }
});

test("Pichincha/Quito has comprehensive parishes", async () => {
  const source = await readFile(
    new URL("./ecuador-locations.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /Cumbayá/);
  assert.match(source, /Tumbaco/);
  assert.match(source, /Calderón/);
  assert.match(source, /Conocoto/);
  assert.match(source, /Sangolquí/);
});

test("Guayaquil has comprehensive parishes", async () => {
  const source = await readFile(
    new URL("./ecuador-locations.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /Tarqui/);
  assert.match(source, /Ximena/);
  assert.match(source, /Febres Cordero/);
});

test("Cuenca has comprehensive parishes", async () => {
  const source = await readFile(
    new URL("./ecuador-locations.ts", import.meta.url),
    "utf8",
  );
  const cuencaBlock = source.match(/name: "Cuenca", parishes: \[([\s\S]*?)\]/);
  assert.ok(cuencaBlock, "Cuenca canton not found");
  const parishes = cuencaBlock![1].match(/"[^"]+"/g) ?? [];
  assert.ok(parishes.length >= 15, `Cuenca should have 15+ parishes, got ${parishes.length}`);
});

test("getEcuadorCantons and getEcuadorParishes functions preserved", async () => {
  const source = await readFile(
    new URL("./ecuador-locations.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /export function getEcuadorCantons/);
  assert.match(source, /export function getEcuadorParishes/);
});

test("Types EcuadorCanton and EcuadorProvince preserved", async () => {
  const source = await readFile(
    new URL("./ecuador-locations.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /export type EcuadorCanton/);
  assert.match(source, /export type EcuadorProvince/);
});

// ── L-P: SRI Payment Codes ──────────────────────────────────────────────────

test("SRI_PAYMENT_LABELS has all 8 codes", async () => {
  const source = await readFile(
    new URL("./payment-method-labels.ts", import.meta.url),
    "utf8",
  );
  for (const code of ["01", "15", "16", "17", "18", "19", "20", "21"]) {
    assert.match(source, new RegExp(`"${code}":`), `Missing SRI code label: ${code}`);
  }
});

test("COMMERCIAL_TO_SRI maps all commercial methods", async () => {
  const source = await readFile(
    new URL("./payment-method-labels.ts", import.meta.url),
    "utf8",
  );
  for (const method of ["cash", "check", "deposit", "transfer", "debit_card", "credit_card", "credit"]) {
    assert.match(source, new RegExp(`${method}:`), `Missing COMMERCIAL_TO_SRI mapping for: ${method}`);
  }
});

test("Invoice editor has independent sriPaymentCode state", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\[sriPaymentCode, setSriPaymentCode\]/);
  assert.match(source, /SRI_PAYMENT_CODES/);
  assert.match(source, /Pag\. SRI/);
});

test("Invoice editor has all 8 SRI codes in the selector", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  for (const code of ["01", "15", "16", "17", "18", "19", "20", "21"]) {
    assert.match(source, new RegExp(`code: "${code}"`), `Missing SRI code ${code} in SRI_PAYMENT_CODES`);
  }
});

// ── Q-T: Payment modal auto-open ────────────────────────────────────────────

test("Invoice editor auto-opens payment modal on method change", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /handlePaymentMethodChange/);
  assert.match(source, /setShowPaymentModal\(true\)/);
  assert.match(source, /setShowMultipleModal\(true\)/);
  assert.doesNotMatch(source, /Configurar/);
});

test("Payment cancel rolls back to previous method", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /prevPaymentMethodRef/);
  assert.match(source, /handlePaymentModalCancel/);
  assert.match(source, /setPaymentMethod\(prevPaymentMethodRef\.current\)/);
});

// ── U: Credit payment ───────────────────────────────────────────────────────

test("Credit modal shows 'Cliente' label and blocks Consumidor Final", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/payment-modal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Cliente:/);
  assert.match(source, /No se permite crédito a Consumidor Final/);
  assert.match(source, /method === "credit" && !hasCustomer/);
});

test("Credit modal has 'Vence hoy' toggle", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/payment-modal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Vence hoy/);
});

// ── V-Z: Stock / trackInventory ─────────────────────────────────────────────

test("Product type includes trackInventory and type fields", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /trackInventory: boolean/);
  assert.match(source, /type: string/);
});

test("getStock returns 999999 for non-tracked products", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /!product\.trackInventory/);
  assert.match(source, /999999/);
});

test("Product mapping in page.tsx passes trackInventory and type", async () => {
  const source = await readFile(
    new URL("../../app/facturacion/sales/new/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /trackInventory: item\.trackInventory/);
  assert.match(source, /type: item\.type/);
});

// ── AD: Costo General ───────────────────────────────────────────────────────

test("Invoice editor has costMode state", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\[costMode, setCostMode\]/);
  assert.match(source, /Costo General/);
});

// ── AE: N.Guía selector ────────────────────────────────────────────────────

test("Invoice editor has searchable shipment guide selector", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /N\.Guía/);
  assert.match(source, /shipmentGuideSearch/);
  assert.match(source, /guideDropdownOpen/);
  assert.match(source, /Seleccionar guía/);
});

// ── AF: Reembolso / Exportación toggles ─────────────────────────────────────

test("Invoice editor uses two toggles for Reembolso/Exportación", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Factura Reembolso/);
  assert.match(source, /Factura de Exportación/);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /REIMBURSEMENT/);
  assert.match(source, /EXPORT/);
});

// ── AG-AI: Fixed 11-row totals ──────────────────────────────────────────────

test("Totals sidebar has all 11 fixed rows", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  const labels = [
    "Subtotal",
    "Subtotal dif",
    "Subtotal 0%",
    "No Objeto de Impuesto",
    "Exento de IVA",
    "Descuento",
    "Subtotal - Descuento",
    "IVA",
    "Total Factura",
    "Total Retención",
    "Total Pagar",
  ];
  for (const label of labels) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Missing totals row: ${label}`);
  }
});

// ── AJ-AK: Draft save ──────────────────────────────────────────────────────

test("Draft payload includes sriPaymentCode and costMode", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /sriPaymentCode: string/);
  assert.match(source, /costMode: string/);
  const draftBlock = source.match(/async function saveDraft[\s\S]*?const payload.*=[\s\S]*?};/);
  assert.ok(draftBlock, "saveDraft function not found");
  assert.match(draftBlock![0], /sriPaymentCode/);
  assert.match(draftBlock![0], /costMode/);
});

test("Draft save does not require lines or customer", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/sales/invoice-editor.tsx", import.meta.url),
    "utf8",
  );
  const draftBlock = source.match(/async function saveDraft[\s\S]*?finally/);
  assert.ok(draftBlock);
  assert.doesNotMatch(draftBlock![0], /lines\.length.*throw/);
  assert.doesNotMatch(draftBlock![0], /customerId.*throw/);
});

// ── AM-AP: POS handoff ──────────────────────────────────────────────────────

test("POS handoff uses 'lines' not 'items' in draft payload", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/basic/pos-client.tsx", import.meta.url),
    "utf8",
  );
  const handoffBlock = source.match(/const draftPayload[\s\S]*?facturacion\/drafts/);
  assert.ok(handoffBlock, "POS handoff block not found");
  assert.match(handoffBlock![0], /lines:/);
  assert.doesNotMatch(handoffBlock![0], /\bitems:/);
});

test("POS handoff uses data.draft.id", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/basic/pos-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /data\.draft\?\.id/);
});

test("POS handoff converts discountAmount to discountPct", async () => {
  const source = await readFile(
    new URL("../../components/appsolux/basic/pos-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /discountPct/);
  const handoffBlock = source.match(/const draftPayload[\s\S]*?lines:/);
  assert.ok(handoffBlock);
  assert.match(source, /discountPct.*Math\.round/);
});

// ── AQ-AU: PDF export ───────────────────────────────────────────────────────

test("Documents PDF export uses generatePdfTable helper", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/documents/export/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /generatePdfTable/);
  assert.doesNotMatch(source, /pdfkit/i);
  assert.match(source, /pdf-table/);
});

test("PDF export has all required columns", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/documents/export/route.ts", import.meta.url),
    "utf8",
  );
  for (const col of ["Fecha", "Tipo", "Número", "Cliente", "Identificación", "Total", "Estado", "SRI", "Autorización"]) {
    assert.match(source, new RegExp(col), `Missing PDF column: ${col}`);
  }
});

test("Excel export still uses ExcelJS", async () => {
  const source = await readFile(
    new URL("../../app/api/facturacion/documents/export/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /ExcelJS/);
  assert.match(source, /addWorksheet.*Documentos/);
  assert.match(source, /addWorksheet.*Resumen/);
});

// ── REVIEW 05 preservation ──────────────────────────────────────────────────

test("REVIEW 05 consolidation test file unchanged and passing shape", async () => {
  const source = await readFile(
    new URL("./review-05-consolidation.test.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /parseMoney/);
  assert.match(source, /ExternalSalesDocument/);
  assert.match(source, /listConsolidatedSales/);
  assert.match(source, /sales_auto_sync/);
});
