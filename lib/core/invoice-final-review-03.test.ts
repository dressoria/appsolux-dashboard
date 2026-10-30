import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnsignedSriInvoiceXmlPreview,
  xmlEscape,
  resolveCommercialPaymentLabel,
  type SriXmlPreviewParams,
} from "./sri-xml";

function baseParams(overrides?: Partial<SriXmlPreviewParams>): SriXmlPreviewParams {
  return {
    documentId: "doc-1",
    profile: {
      legalName: "ACME S.A.",
      tradeName: "ACME",
      ruc: "1790016919001",
      environment: "TEST",
      accountingRequired: true,
    },
    establishment: { code: "001", name: "Matriz", address: "Quito" },
    issuePoint: { code: "001" },
    sequentialNumber: 1,
    document: {
      documentType: "INVOICE",
      customerName: "Juan Pérez",
      customerIdentification: "1717171717",
      customerIdentificationType: "CEDULA",
      subtotal: 100,
      taxTotal: 15,
      discountTotal: 0,
      grandTotal: 115,
      sriPaymentCode: "01",
      issuedAt: new Date("2026-10-29"),
      createdAt: new Date("2026-10-29"),
    },
    lines: [
      {
        itemName: "Widget",
        itemCode: "PROD-001",
        quantity: 2,
        unitPrice: 50,
        discountAmount: 0,
        subtotal: 100,
        taxRate: 15,
        taxAmount: 15,
      },
    ],
    ...overrides,
  };
}

// ─── SRI multi-payment XML ────────────────────────────────────────────

test("multi-payment: XML genera múltiples <pago> con códigos correctos", () => {
  const params = baseParams({
    document: {
      ...baseParams().document,
      grandTotal: 115,
    },
    payments: [
      { sriPaymentCode: "01", total: 50, termDays: 0, timeUnit: "dias" },
      { sriPaymentCode: "19", total: 65, termDays: 0, timeUnit: "dias" },
    ],
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  const pagoMatches = xml.match(/<pago>/g);
  assert.equal(pagoMatches?.length, 2, "Debe haber exactamente 2 <pago>");
  assert.ok(xml.includes("<formaPago>01</formaPago>"));
  assert.ok(xml.includes("<formaPago>19</formaPago>"));
  assert.ok(xml.includes("<total>50.00</total>"));
  assert.ok(xml.includes("<total>65.00</total>"));
});

test("single-payment: XML genera un solo <pago> con legacy fallback", () => {
  const params = baseParams();
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  const pagoMatches = xml.match(/<pago>/g);
  assert.equal(pagoMatches?.length, 1, "Debe haber exactamente 1 <pago>");
  assert.ok(xml.includes("<formaPago>01</formaPago>"));
  assert.ok(xml.includes("<total>115.00</total>"));
});

test("multi-payment: crédito genera plazo > 0", () => {
  const params = baseParams({
    payments: [
      { sriPaymentCode: "20", total: 115, termDays: 30, timeUnit: "dias" },
    ],
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(xml.includes("<plazo>30</plazo>"));
  assert.ok(xml.includes("<formaPago>20</formaPago>"));
});

// ─── Tax category mapping in XML ──────────────────────────────────────

test("NON_OBJECT línea genera codigoPorcentaje 6 en XML", () => {
  const params = baseParams({
    lines: [
      {
        itemName: "Servicio exento",
        itemCode: "SVC-001",
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
        subtotal: 100,
        taxRate: 0,
        taxAmount: 0,
        taxCategory: "NON_OBJECT",
      },
    ],
    document: {
      ...baseParams().document,
      subtotal: 100,
      taxTotal: 0,
      grandTotal: 100,
    },
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(xml.includes("<codigoPorcentaje>6</codigoPorcentaje>"), "NON_OBJECT → código 6");
});

test("EXEMPT línea genera codigoPorcentaje 7 en XML", () => {
  const params = baseParams({
    lines: [
      {
        itemName: "Producto exento",
        itemCode: "EXE-001",
        quantity: 1,
        unitPrice: 50,
        discountAmount: 0,
        subtotal: 50,
        taxRate: 0,
        taxAmount: 0,
        taxCategory: "EXEMPT",
      },
    ],
    document: {
      ...baseParams().document,
      subtotal: 50,
      taxTotal: 0,
      grandTotal: 50,
    },
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(xml.includes("<codigoPorcentaje>7</codigoPorcentaje>"), "EXEMPT → código 7");
});

test("ZERO línea genera codigoPorcentaje 0 en XML", () => {
  const params = baseParams({
    lines: [
      {
        itemName: "Producto 0%",
        itemCode: "ZER-001",
        quantity: 1,
        unitPrice: 80,
        discountAmount: 0,
        subtotal: 80,
        taxRate: 0,
        taxAmount: 0,
        taxCategory: "ZERO",
      },
    ],
    document: {
      ...baseParams().document,
      subtotal: 80,
      taxTotal: 0,
      grandTotal: 80,
    },
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(xml.includes("<codigoPorcentaje>0</codigoPorcentaje>"), "ZERO → código 0");
});

test("TAXABLE 15% genera codigoPorcentaje 4 en XML", () => {
  const params = baseParams({
    lines: [
      {
        itemName: "Producto 15%",
        itemCode: "TAX-001",
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
        subtotal: 100,
        taxRate: 15,
        taxAmount: 15,
        taxCategory: "TAXABLE",
      },
    ],
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(xml.includes("<codigoPorcentaje>4</codigoPorcentaje>"), "15% → código 4");
});

// ─── Guía de remisión en XML ──────────────────────────────────────────

test("guiaRemision aparece en XML cuando se proporciona guideNumber", () => {
  const params = baseParams({
    document: {
      ...baseParams().document,
      guideNumber: "001-001-000000001",
    },
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(xml.includes("<guiaRemision>001-001-000000001</guiaRemision>"));
});

test("guiaRemision no aparece cuando guideNumber es null", () => {
  const params = baseParams();
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(!xml.includes("<guiaRemision>"));
});

// ─── COMMERCIAL_TO_SRI mapping ────────────────────────────────────────

import { COMMERCIAL_TO_SRI, COMMERCIAL_LABELS } from "./payment-method-labels";

test("COMMERCIAL_TO_SRI mapea todos los métodos comerciales", () => {
  assert.equal(COMMERCIAL_TO_SRI["cash"], "01");
  assert.equal(COMMERCIAL_TO_SRI["check"], "20");
  assert.equal(COMMERCIAL_TO_SRI["deposit"], "20");
  assert.equal(COMMERCIAL_TO_SRI["transfer"], "20");
  assert.equal(COMMERCIAL_TO_SRI["debit_card"], "16");
  assert.equal(COMMERCIAL_TO_SRI["credit_card"], "19");
  assert.equal(COMMERCIAL_TO_SRI["card"], "19");
  assert.equal(COMMERCIAL_TO_SRI["credit"], "20");
});

test("COMMERCIAL_LABELS tiene etiquetas para todos los métodos", () => {
  assert.equal(COMMERCIAL_LABELS["cash"], "Efectivo");
  assert.equal(COMMERCIAL_LABELS["check"], "Cheque");
  assert.equal(COMMERCIAL_LABELS["deposit"], "Depósito");
  assert.equal(COMMERCIAL_LABELS["transfer"], "Transferencia");
  assert.equal(COMMERCIAL_LABELS["debit_card"], "Débito");
  assert.equal(COMMERCIAL_LABELS["credit_card"], "Tarjeta de crédito");
  assert.equal(COMMERCIAL_LABELS["credit"], "Crédito");
});

// ─── resolveCommercialPaymentLabel ────────────────────────────────────

test("resolveCommercialPaymentLabel devuelve labels correctos", () => {
  assert.equal(resolveCommercialPaymentLabel("cash"), "EFECTIVO");
  assert.equal(resolveCommercialPaymentLabel("card"), "TARJETA");
  assert.equal(resolveCommercialPaymentLabel("transfer"), "TRANSFERENCIA");
  assert.equal(resolveCommercialPaymentLabel("credit"), "CRÉDITO");
  assert.equal(resolveCommercialPaymentLabel("multiple"), "MULTIPLE");
});

// ─── xmlEscape ────────────────────────────────────────────────────────

test("xmlEscape escapa caracteres XML especiales", () => {
  assert.equal(xmlEscape("A & B < C > D"), "A &amp; B &lt; C &gt; D");
  assert.equal(xmlEscape('say "hello"'), "say &quot;hello&quot;");
});

// ─── Mixed tax categories in same invoice ─────────────────────────────

test("factura mixta con TAXABLE + NON_OBJECT produce ambos códigos en totalConImpuestos", () => {
  const params = baseParams({
    lines: [
      {
        itemName: "Producto 15%",
        itemCode: "TAX-001",
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
        subtotal: 100,
        taxRate: 15,
        taxAmount: 15,
        taxCategory: "TAXABLE",
      },
      {
        itemName: "Servicio N/O",
        itemCode: "SVC-001",
        quantity: 1,
        unitPrice: 50,
        discountAmount: 0,
        subtotal: 50,
        taxRate: 0,
        taxAmount: 0,
        taxCategory: "NON_OBJECT",
      },
    ],
    document: {
      ...baseParams().document,
      subtotal: 150,
      taxTotal: 15,
      grandTotal: 165,
    },
  });
  const { xml } = buildUnsignedSriInvoiceXmlPreview(params);
  assert.ok(xml.includes("<codigoPorcentaje>4</codigoPorcentaje>"), "15% line → 4");
  assert.ok(xml.includes("<codigoPorcentaje>6</codigoPorcentaje>"), "NON_OBJECT line → 6");
  const totalImpuestoBlocks = xml.match(/<totalImpuesto>/g);
  assert.ok(totalImpuestoBlocks && totalImpuestoBlocks.length >= 2, "Al menos 2 bloques totalImpuesto");
});
