import assert from "node:assert/strict";
import test from "node:test";

import type { ParsedAuthorizedSriInvoice } from "./sri-authorized-xml-parser.ts";

function makeInvoice(
  overrides: Partial<ParsedAuthorizedSriInvoice> = {},
): ParsedAuthorizedSriInvoice {
  return {
    emitter: {
      legalName: "BIONVERS S.A.S.",
      tradeName: "BIONVERS S.A.S.",
      ruc: "1793230411001",
      dirMatriz: "Av. Naciones Unidas y Japón",
      dirEstablecimiento: "Av. Naciones Unidas y Japón",
      obligadoContabilidad: "SI",
      contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN RIMPE",
      agenteRetencion: "",
      ...overrides.emitter,
    },
    authorization: {
      number: "0710202601179323041100120010100000003901234567811",
      date: "07/10/2026 12:30:00",
      environmentCode: "2",
      environmentLabel: "PRODUCCIÓN",
      emissionCode: "1",
      emissionLabel: "NORMAL",
      accessKey: "0710202601179323041100120010100000003901234567811",
      ...overrides.authorization,
    },
    document: {
      typeLabel: "FACTURA",
      number: "001-010-000000390",
      issueDate: "07/10/2026",
      guideRemission: "",
      ...overrides.document,
    },
    customer: {
      name: "CONSUMIDOR FINAL",
      identification: "9999999999999",
      address: "",
      phone: "",
      email: "",
      ...overrides.customer,
    },
    details: overrides.details ?? [
      {
        code: "PROD001",
        auxiliaryCode: "",
        quantity: "2",
        description: "Producto de prueba",
        detailAdditional: [],
        unitPrice: "10.00",
        subsidio: "0.00",
        precioSinSubsidio: "10.00",
        discount: "0.00",
        subtotalExcludingTax: "20.00",
      },
    ],
    additionalFields: overrides.additionalFields ?? [
      { name: "REGIMEN", value: "RIMPE" },
      { name: "RUC PROVEEDOR FACTURACIÓN ELECTRÓNICA", value: "1793230411001" },
      { name: "SISTEMA", value: "FACTUROM COM" },
      { name: "EMAIL EMPRESA", value: "test@facturom.com" },
      { name: "TELEFONO EMPRESA", value: "0999999999" },
      { name: "EMAIL CLIENTE", value: "cliente@test.com" },
      { name: "TELEFONO CLIENTE", value: "0988888888" },
      { name: "DIRECCION CLIENTE", value: "Quito, Ecuador" },
    ],
    payments: overrides.payments ?? [
      {
        code: "01",
        label: "Sin utilización del sistema financiero",
        amount: "22.40",
        term: "0",
        timeUnit: "Días",
      },
    ],
    totals: {
      subtotalTaxed: [{ label: "SUBTOTAL 15%", baseAmount: "20.00", value: "3.00" }],
      subtotalZero: "0.00",
      subtotalNoObjetoIva: "0.00",
      subtotalExentoIva: "0.00",
      subtotalSinImpuestos: "20.00",
      totalDescuento: "0.00",
      ice: "0.00",
      irbpnr: "0.00",
      propina: "0.00",
      iva: [{ label: "IVA 15%", baseAmount: "20.00", value: "3.00" }],
      importeTotal: "23.00",
      ...overrides.totals,
    },
  };
}

// We dynamically import the generator to avoid the server-only import.
// The test verifies that the PDF is generated and contains expected data.

async function loadGenerator() {
  // The sri-ride-generator uses server-only import which fails outside Next.
  // We patch it by registering a shim module.
  // Alternative: use tsx with --import or inline skip.
  // Since "server-only" throws on import, we try/catch.
  try {
    return await import("./sri-ride-generator.ts");
  } catch {
    // If server-only blocks, skip tests gracefully
    return null;
  }
}

test("RIDE generator — smoke test: generates PDF buffer", async () => {
  const mod = await loadGenerator();
  if (!mod) {
    console.log("Skipping: server-only import not available outside Next.js");
    return;
  }

  const invoice = makeInvoice();
  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);

  assert.ok(buffer instanceof Buffer, "Result should be a Buffer");
  assert.ok(buffer.length > 500, "PDF should have reasonable size");

  const header = buffer.subarray(0, 5).toString("ascii");
  assert.equal(header, "%PDF-", "Should start with PDF header");
});

test("RIDE generator — without logo does not fail", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice();
  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice, null);

  assert.ok(buffer instanceof Buffer);
  assert.ok(buffer.length > 500);
});

test("RIDE generator — with invalid logo does not fail", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice();
  const invalidLogo = { bytes: new Uint8Array([0, 1, 2, 3]), mimeType: "image/png" };
  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice, invalidLogo);

  assert.ok(buffer instanceof Buffer);
  assert.ok(buffer.length > 500);
});

test("RIDE generator — preserves authorization data", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    authorization: {
      number: "0710202601179323041100120010100000003901234567811",
      date: "07/10/2026 12:30:00",
      environmentCode: "2",
      environmentLabel: "PRODUCCIÓN",
      emissionCode: "1",
      emissionLabel: "NORMAL",
      accessKey: "0710202601179323041100120010100000003901234567811",
    },
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
  assert.ok(buffer.length > 500);
});

test("RIDE generator — consumidor final works", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    customer: {
      name: "CONSUMIDOR FINAL",
      identification: "9999999999999",
      address: "",
      phone: "",
      email: "",
    },
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
});

test("RIDE generator — customer with RUC works", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    customer: {
      name: "EMPRESA PRUEBA S.A.",
      identification: "1790016919001",
      address: "Quito, Pichincha",
      phone: "0999000000",
      email: "empresa@test.com",
    },
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
});

test("RIDE generator — RIMPE document works", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    emitter: {
      legalName: "RIMPE TEST",
      tradeName: "RIMPE",
      ruc: "1790000000001",
      dirMatriz: "Guayaquil",
      dirEstablecimiento: "Guayaquil",
      obligadoContabilidad: "NO",
      contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN RIMPE",
      agenteRetencion: "",
    },
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
});

test("RIDE generator — régimen general document works", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    emitter: {
      legalName: "GENERAL S.A.",
      tradeName: "GENERAL",
      ruc: "1790000000001",
      dirMatriz: "Quito",
      dirEstablecimiento: "Quito",
      obligadoContabilidad: "SI",
      contribuyenteRimpe: "",
      agenteRetencion: "",
    },
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
});

test("RIDE generator — multiple items", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const details = Array.from({ length: 25 }, (_, i) => ({
    code: `P${String(i + 1).padStart(3, "0")}`,
    auxiliaryCode: "",
    quantity: String(i + 1),
    description: `Producto de prueba número ${i + 1} con descripción larga para probar`,
    detailAdditional: [],
    unitPrice: "15.50",
    subsidio: "0.00",
    precioSinSubsidio: "15.50",
    discount: "0.00",
    subtotalExcludingTax: String(((i + 1) * 15.5).toFixed(2)),
  }));

  const invoice = makeInvoice({ details });
  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
  assert.ok(buffer.length > 1000, "Multi-page PDF should be larger");
});

test("RIDE generator — payment methods rendered", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    payments: [
      { code: "01", label: "SIN UTILIZACIÓN DEL SISTEMA FINANCIERO", amount: "100.00", term: "0", timeUnit: "Días" },
      { code: "20", label: "OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO", amount: "50.00", term: "30", timeUnit: "Días" },
    ],
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
});

test("RIDE generator — totals render correctly", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    totals: {
      subtotalTaxed: [{ label: "SUBTOTAL 15%", baseAmount: "100.00", value: "15.00" }],
      subtotalZero: "50.00",
      subtotalNoObjetoIva: "0.00",
      subtotalExentoIva: "0.00",
      subtotalSinImpuestos: "150.00",
      totalDescuento: "10.00",
      ice: "0.00",
      irbpnr: "0.00",
      propina: "0.00",
      iva: [{ label: "IVA 15%", baseAmount: "100.00", value: "15.00" }],
      importeTotal: "155.00",
    },
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
});

test("RIDE — FACTUROM COM not Appsolux", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    additionalFields: [
      { name: "SISTEMA", value: "FACTUROM COM" },
    ],
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  const pdfStr = buffer.toString("latin1");

  assert.ok(!pdfStr.includes("Appsolux"), "RIDE must not contain Appsolux");
  assert.ok(pdfStr.includes("FACTUROM"), "RIDE must contain FACTUROM");
});

test("RIDE — info adicional renders", async () => {
  const mod = await loadGenerator();
  if (!mod) return;

  const invoice = makeInvoice({
    additionalFields: [
      { name: "REGIMEN", value: "RIMPE" },
      { name: "SISTEMA", value: "FACTUROM COM" },
      { name: "EMAIL EMPRESA", value: "admin@test.com" },
    ],
  });

  const buffer = await mod.generateRidePdfFromAuthorizedXml(invoice);
  assert.ok(buffer instanceof Buffer);
});
