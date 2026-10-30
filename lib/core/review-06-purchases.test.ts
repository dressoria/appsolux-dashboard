import assert from "node:assert/strict";
import test from "node:test";

import {
  TAX_SUPPORT_CATALOG,
  getTaxSupportForDocumentType,
  isValidTaxSupportCombination,
  suggestTaxSupportCode,
  PURCHASE_DOCUMENT_TYPE_LABELS,
} from "./tax-support-catalog";
import { SRI_PAYMENT_CODES, getSriPaymentCodeLabel } from "./sri-payment-codes";
import { buildWithholdingV2Xml } from "./purchase-withholding-v2-xml";
import { buildWithholdingXml } from "./purchase-withholding-xml";
import { buildSettlementXml } from "./purchase-settlement-xml";
import { parsePurchaseXml } from "./purchase-xml-import";
import {
  SriPurchaseSourceAdapter,
  getAdapterForTenant,
} from "./purchase-sync-adapter";

// =====================================================================
// PART A: Tax Support Catalog (codes 01-15)
// =====================================================================

test("A01 – TAX_SUPPORT_CATALOG contains exactly 15 entries", () => {
  assert.equal(TAX_SUPPORT_CATALOG.length, 15);
});

test("A02 – Each catalog code is a unique zero-padded two-digit string from 01 to 15", () => {
  const codes = TAX_SUPPORT_CATALOG.map((e) => e.code);
  const expected = Array.from({ length: 15 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  assert.deepEqual(codes, expected);
});

test("A03 – Every entry has description and at least one compatibleDocumentType", () => {
  for (const entry of TAX_SUPPORT_CATALOG) {
    assert.ok(entry.description.length > 0, `code ${entry.code} missing description`);
    assert.ok(entry.compatibleDocumentTypes.length > 0, `code ${entry.code} missing compatible types`);
  }
});

test("A04 – getTaxSupportForDocumentType INVOICE returns codes 01-15", () => {
  const result = getTaxSupportForDocumentType("INVOICE");
  assert.equal(result.length, 15);
});

test("A05 – getTaxSupportForDocumentType CREDIT_NOTE excludes codes 05,08,09-15", () => {
  const result = getTaxSupportForDocumentType("CREDIT_NOTE");
  const codes = result.map((e) => e.code);
  assert.ok(codes.includes("01"));
  assert.ok(codes.includes("06"));
  assert.ok(!codes.includes("05"));
  assert.ok(!codes.includes("09"));
  assert.ok(!codes.includes("15"));
});

test("A06 – getTaxSupportForDocumentType DEBIT_NOTE matches CREDIT_NOTE set", () => {
  const cn = getTaxSupportForDocumentType("CREDIT_NOTE").map((e) => e.code);
  const dn = getTaxSupportForDocumentType("DEBIT_NOTE").map((e) => e.code);
  assert.deepEqual(cn, dn);
});

test("A07 – getTaxSupportForDocumentType PURCHASE_SETTLEMENT returns only 05,08,10", () => {
  const result = getTaxSupportForDocumentType("PURCHASE_SETTLEMENT");
  const codes = result.map((e) => e.code);
  assert.deepEqual(codes.sort(), ["05", "08", "10"]);
});

test("A08 – isValidTaxSupportCombination returns true for valid pair", () => {
  assert.equal(isValidTaxSupportCombination("01", "INVOICE"), true);
  assert.equal(isValidTaxSupportCombination("06", "CREDIT_NOTE"), true);
  assert.equal(isValidTaxSupportCombination("05", "PURCHASE_SETTLEMENT"), true);
});

test("A09 – isValidTaxSupportCombination returns false for invalid pair", () => {
  assert.equal(isValidTaxSupportCombination("05", "CREDIT_NOTE"), false);
  assert.equal(isValidTaxSupportCombination("09", "PURCHASE_SETTLEMENT"), false);
  assert.equal(isValidTaxSupportCombination("15", "DEBIT_NOTE"), false);
});

test("A10 – isValidTaxSupportCombination returns false for unknown code", () => {
  assert.equal(isValidTaxSupportCombination("99", "INVOICE"), false);
  assert.equal(isValidTaxSupportCombination("", "INVOICE"), false);
});

test("A11 – suggestTaxSupportCode returns 06 for MERCHANDISE", () => {
  assert.equal(suggestTaxSupportCode("MERCHANDISE"), "06");
});

test("A12 – suggestTaxSupportCode returns 01 for EXPENSE_SERVICE", () => {
  assert.equal(suggestTaxSupportCode("EXPENSE_SERVICE"), "01");
});

test("A13 – suggestTaxSupportCode returns null for unknown or null", () => {
  assert.equal(suggestTaxSupportCode(null), null);
  assert.equal(suggestTaxSupportCode("OTHER"), null);
});

test("A14 – PURCHASE_DOCUMENT_TYPE_LABELS has standard types", () => {
  assert.equal(PURCHASE_DOCUMENT_TYPE_LABELS["INVOICE"], "01 · Factura");
  assert.equal(PURCHASE_DOCUMENT_TYPE_LABELS["CREDIT_NOTE"], "04 · Nota de crédito");
  assert.equal(PURCHASE_DOCUMENT_TYPE_LABELS["DEBIT_NOTE"], "05 · Nota de débito");
});

// =====================================================================
// PART B: SRI Payment Codes
// =====================================================================

test("B01 – SRI_PAYMENT_CODES contains codes 01, 15-21", () => {
  const codes = SRI_PAYMENT_CODES.map((e) => e.code);
  assert.ok(codes.includes("01"));
  assert.ok(codes.includes("15"));
  assert.ok(codes.includes("21"));
  assert.equal(codes.length, 8);
});

test("B02 – getSriPaymentCodeLabel returns formatted label", () => {
  const label = getSriPaymentCodeLabel("19");
  assert.ok(label.includes("19"));
  assert.ok(label.includes("TARJETA DE CRÉDITO"));
});

test("B03 – getSriPaymentCodeLabel returns code itself if unknown", () => {
  assert.equal(getSriPaymentCodeLabel("99"), "99");
});

// =====================================================================
// PART C: Withholding v2 XML builder
// =====================================================================

const baseV2Profile = {
  legalName: "Mi Empresa S.A.",
  tradeName: "Mi Empresa",
  ruc: "1790012345001",
  environment: "TEST" as const,
  accountingRequired: true,
};

const baseV2Params = {
  documentId: "wh-v2-test",
  accessKey: "0710202607179001234500107001001000000001123456781",
  profile: baseV2Profile,
  establishment: { code: "001", address: "Quito, Ecuador" },
  issuePoint: { code: "001" },
  sequentialNumber: 1,
  issuedAt: new Date("2026-10-07T12:00:00-05:00"),
  supplier: {
    name: "Proveedor XYZ",
    identification: "1710034065001",
    identificationType: "RUC" as const,
  },
  fiscalPeriod: "10/2026",
};

test("C01 – buildWithholdingV2Xml generates version 2.0.0 envelope", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supportDocuments: [{
      codSustento: "01",
      codDocSustento: "01",
      numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"),
      fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "0710202601179001234500101001001000000001123456781",
      pagoLocExt: "01",
      totalSinImpuestos: 1000,
      importeTotal: 1150,
      taxes: [{ codImpuestoDocSustento: "2", codigoPorcentaje: "4", baseImponible: 1000, tarifa: 15, valorImpuesto: 150 }],
      retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 1000, porcentajeRetener: 10, valorRetenido: 100 }],
      payments: [{ formaPago: "20", total: 1150 }],
    }],
  });

  assert.ok(xml.includes('version="2.0.0"'));
  assert.ok(xml.includes("<comprobanteRetencion"));
  assert.ok(xml.includes("<codDoc>07</codDoc>"));
  assert.ok(xml.includes("<periodoFiscal>10/2026</periodoFiscal>"));
});

test("C02 – v2 XML includes docsSustento block", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supportDocuments: [{
      codSustento: "01",
      codDocSustento: "01",
      numDocSustento: "001-001-000000042",
      fechaEmisionDocSustento: new Date("2026-10-01"),
      fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTHKEY123",
      pagoLocExt: "01",
      totalSinImpuestos: 500,
      importeTotal: 575,
      taxes: [{ codImpuestoDocSustento: "2", codigoPorcentaje: "4", baseImponible: 500, tarifa: 15, valorImpuesto: 75 }],
      retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 500, porcentajeRetener: 10, valorRetenido: 50 }],
      payments: [{ formaPago: "01", total: 575 }],
    }],
  });

  assert.ok(xml.includes("<docsSustento>"));
  assert.ok(xml.includes("<docSustento>"));
  assert.ok(xml.includes("<codSustento>01</codSustento>"));
  assert.ok(xml.includes("<codDocSustento>01</codDocSustento>"));
  assert.ok(xml.includes("<numDocSustento>001-001-000000042</numDocSustento>"));
});

test("C03 – v2 XML includes impuestosDocSustento", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 115,
      taxes: [
        { codImpuestoDocSustento: "2", codigoPorcentaje: "4", baseImponible: 100, tarifa: 15, valorImpuesto: 15 },
      ],
      retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [],
    }],
  });

  assert.ok(xml.includes("<impuestosDocSustento>"));
  assert.ok(xml.includes("<impuestoDocSustento>"));
  assert.ok(xml.includes("<codImpuestoDocSustento>2</codImpuestoDocSustento>"));
  assert.ok(xml.includes("<codigoPorcentaje>4</codigoPorcentaje>"));
});

test("C04 – v2 XML retentions include codigo, codigoRetencion, percentage, amount", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 1000, importeTotal: 1150,
      taxes: [{ codImpuestoDocSustento: "2", codigoPorcentaje: "4", baseImponible: 1000, tarifa: 15, valorImpuesto: 150 }],
      retentions: [
        { codigo: "1", codigoRetencion: "303", baseImponible: 1000, porcentajeRetener: 10, valorRetenido: 100 },
        { codigo: "2", codigoRetencion: "725", baseImponible: 150, porcentajeRetener: 30, valorRetenido: 45 },
      ],
      payments: [],
    }],
  });

  assert.ok(xml.includes("<retenciones>"));
  assert.ok(xml.includes("<retencion>"));
  assert.ok(xml.includes("<codigo>1</codigo>"));
  assert.ok(xml.includes("<codigoRetencion>303</codigoRetencion>"));
  assert.ok(xml.includes("<porcentajeRetener>10.00</porcentajeRetener>"));
  assert.ok(xml.includes("<valorRetenido>100.00</valorRetenido>"));
  assert.ok(xml.includes("<codigo>2</codigo>"));
  assert.ok(xml.includes("<codigoRetencion>725</codigoRetencion>"));
});

test("C05 – v2 XML pagos block present when payments provided", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 115,
      taxes: [{ codImpuestoDocSustento: "2", codigoPorcentaje: "4", baseImponible: 100, tarifa: 15, valorImpuesto: 15 }],
      retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [{ formaPago: "20", total: 115 }],
    }],
  });

  assert.ok(xml.includes("<pagos>"));
  assert.ok(xml.includes("<formaPago>20</formaPago>"));
  assert.ok(xml.includes("<total>115.00</total>"));
});

test("C06 – v2 XML pagos block absent when payments empty", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 115,
      taxes: [{ codImpuestoDocSustento: "2", codigoPorcentaje: "4", baseImponible: 100, tarifa: 15, valorImpuesto: 15 }],
      retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [],
    }],
  });

  assert.ok(!xml.includes("<pagos>"));
});

test("C07 – v2 XML supplier identified by RUC (13 digits → tipo 04)", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 115,
      taxes: [{ codImpuestoDocSustento: "2", codigoPorcentaje: "4", baseImponible: 100, tarifa: 15, valorImpuesto: 15 }],
      retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [],
    }],
  });

  assert.ok(xml.includes("<tipoIdentificacionSujetoRetenido>04</tipoIdentificacionSujetoRetenido>"));
  assert.ok(xml.includes("<razonSocialSujetoRetenido>Proveedor XYZ</razonSocialSujetoRetenido>"));
});

test("C08 – v2 XML supplier identified by cedula (10 digits → tipo 05)", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    supplier: { name: "Juan Pérez", identification: "1710034065" },
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 100,
      taxes: [], retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [],
    }],
  });

  assert.ok(xml.includes("<tipoIdentificacionSujetoRetenido>05</tipoIdentificacionSujetoRetenido>"));
});

test("C09 – v2 XML includes additional info fields", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    profile: { ...baseV2Profile, companyEmail: "info@empresa.com" },
    additionalInfo: [{ name: "NOTA", value: "Test note" }],
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 100,
      taxes: [], retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [],
    }],
  });

  assert.ok(xml.includes("<infoAdicional>"));
  assert.ok(xml.includes('nombre="NOTA"'));
  assert.ok(xml.includes("Test note"));
  assert.ok(xml.includes('nombre="EMAIL EMPRESA"'));
  assert.ok(xml.includes("info@empresa.com"));
});

test("C10 – v1 withholding builder still works (backward compatible)", () => {
  const xml = buildWithholdingXml({
    documentId: "wh-v1-test",
    accessKey: "0710202607179001234500107001001000000001123456781",
    profile: { ...baseV2Profile },
    establishment: { code: "001", address: "Quito" },
    issuePoint: { code: "001" },
    sequentialNumber: 1,
    issuedAt: new Date("2026-10-07"),
    supplier: { name: "Prov", identification: "1710034065001" },
    fiscalPeriod: "10/2026",
    lines: [{ taxType: "RENTA", code: "303", taxBase: 100, percentage: 10, retainedAmount: 10 }],
  });

  assert.ok(xml.includes("<comprobanteRetencion"));
  assert.ok(!xml.includes('version="2.0.0"'));
  assert.ok(xml.includes("<periodoFiscal>10/2026</periodoFiscal>"));
});

test("C11 – v2 XML includes contribuyenteRimpe when applicable", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    profile: {
      ...baseV2Profile,
      contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN RIMPE",
      taxRegimeCode: "RIMPE_EMPRENDEDOR",
    },
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 100,
      taxes: [], retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [],
    }],
  });

  assert.ok(xml.includes("<contribuyenteRimpe>"));
});

test("C12 – v2 XML includes contribuyenteEspecial when set", () => {
  const xml = buildWithholdingV2Xml({
    ...baseV2Params,
    profile: { ...baseV2Profile, specialTaxpayerNumber: "12345" },
    supportDocuments: [{
      codSustento: "01", codDocSustento: "01", numDocSustento: "001-001-000000001",
      fechaEmisionDocSustento: new Date("2026-10-01"), fechaRegistroContable: new Date("2026-10-07"),
      numAutDocSustento: "AUTH", pagoLocExt: "01", totalSinImpuestos: 100, importeTotal: 100,
      taxes: [], retentions: [{ codigo: "1", codigoRetencion: "303", baseImponible: 100, porcentajeRetener: 10, valorRetenido: 10 }],
      payments: [],
    }],
  });

  assert.ok(xml.includes("<contribuyenteEspecial>12345</contribuyenteEspecial>"));
});

// =====================================================================
// PART D: Settlement XML — 5%, 8%, unsupported rate error
// =====================================================================

const baseSettlementParams = {
  documentId: "set-test",
  accessKey: "0710202603179001234500103001001000000001123456781",
  profile: {
    legalName: "Mi Empresa S.A.",
    tradeName: "Mi Empresa",
    ruc: "1790012345001",
    environment: "TEST" as const,
    accountingRequired: true,
  },
  establishment: { code: "001", address: "Quito, Ecuador" },
  issuePoint: { code: "001" },
  issuedAt: new Date("2026-10-07T12:00:00-05:00"),
  supplier: {
    name: "Agricultor",
    identification: "1710034065",
    identificationType: "CEDULA" as const,
  },
};

test("D01 – Settlement supports 5% tariff (codigoPorcentaje 5)", () => {
  const xml = buildSettlementXml({
    ...baseSettlementParams,
    sequentialNumber: 10,
    lines: [{ description: "Producto 5%", quantity: 10, unitPrice: 10, discountAmount: 0, subtotal: 100, taxRate: 5, taxAmount: 5 }],
    subtotal: 100, discountTotal: 0, taxTotal: 5, grandTotal: 105, sriPaymentCode: "01",
  });

  assert.ok(xml.includes("<codigoPorcentaje>5</codigoPorcentaje>"));
  assert.ok(xml.includes("<tarifa>5.00</tarifa>"));
});

test("D02 – Settlement supports 8% tariff (codigoPorcentaje 8)", () => {
  const xml = buildSettlementXml({
    ...baseSettlementParams,
    sequentialNumber: 11,
    lines: [{ description: "Producto 8%", quantity: 1, unitPrice: 100, discountAmount: 0, subtotal: 100, taxRate: 8, taxAmount: 8 }],
    subtotal: 100, discountTotal: 0, taxTotal: 8, grandTotal: 108, sriPaymentCode: "01",
  });

  assert.ok(xml.includes("<codigoPorcentaje>8</codigoPorcentaje>"));
});

test("D03 – Settlement supports 0% tariff (codigoPorcentaje 0)", () => {
  const xml = buildSettlementXml({
    ...baseSettlementParams,
    sequentialNumber: 12,
    lines: [{ description: "Producto 0%", quantity: 5, unitPrice: 20, discountAmount: 0, subtotal: 100, taxRate: 0, taxAmount: 0 }],
    subtotal: 100, discountTotal: 0, taxTotal: 0, grandTotal: 100, sriPaymentCode: "01",
  });

  assert.ok(xml.includes("<codigoPorcentaje>0</codigoPorcentaje>"));
});

test("D04 – Settlement supports 15% tariff (codigoPorcentaje 4)", () => {
  const xml = buildSettlementXml({
    ...baseSettlementParams,
    sequentialNumber: 13,
    lines: [{ description: "Producto 15%", quantity: 1, unitPrice: 200, discountAmount: 0, subtotal: 200, taxRate: 15, taxAmount: 30 }],
    subtotal: 200, discountTotal: 0, taxTotal: 30, grandTotal: 230, sriPaymentCode: "01",
  });

  assert.ok(xml.includes("<codigoPorcentaje>4</codigoPorcentaje>"));
  assert.ok(xml.includes("<tarifa>15.00</tarifa>"));
});

test("D05 – Settlement throws on unsupported tax rate (e.g. 14%)", () => {
  assert.throws(
    () => buildSettlementXml({
      ...baseSettlementParams,
      sequentialNumber: 14,
      lines: [{ description: "Bad rate", quantity: 1, unitPrice: 100, discountAmount: 0, subtotal: 100, taxRate: 14, taxAmount: 14 }],
      subtotal: 100, discountTotal: 0, taxTotal: 14, grandTotal: 114, sriPaymentCode: "01",
    }),
    (err: Error) => err.message.includes("14%"),
  );
});

test("D06 – Settlement decimal precision (2-6 decimals in quantities/prices)", () => {
  const xml = buildSettlementXml({
    ...baseSettlementParams,
    sequentialNumber: 15,
    lines: [{
      description: "Item preciso",
      quantity: 1.5,
      unitPrice: 10.3456,
      discountAmount: 0.5,
      subtotal: 15.0184,
      taxRate: 15,
      taxAmount: 2.2528,
    }],
    subtotal: 15.0184, discountTotal: 0.5, taxTotal: 2.2528, grandTotal: 17.2712, sriPaymentCode: "01",
  });

  assert.ok(xml.includes("<cantidad>1.5000</cantidad>"));
  assert.ok(xml.includes("<precioUnitario>10.3456</precioUnitario>"));
  assert.ok(xml.includes("<descuento>0.50</descuento>"));
});

test("D07 – Settlement uses codDoc 03 for liquidación de compra", () => {
  const xml = buildSettlementXml({
    ...baseSettlementParams,
    sequentialNumber: 16,
    lines: [{ description: "Item", quantity: 1, unitPrice: 10, discountAmount: 0, subtotal: 10, taxRate: 0, taxAmount: 0 }],
    subtotal: 10, discountTotal: 0, taxTotal: 0, grandTotal: 10, sriPaymentCode: "01",
  });

  assert.ok(xml.includes("<codDoc>03</codDoc>"));
  assert.ok(xml.includes('version="1.1.0"'));
  assert.ok(xml.includes("<liquidacionCompra"));
});

test("D08 – Settlement multiple tax rates in same document", () => {
  const xml = buildSettlementXml({
    ...baseSettlementParams,
    sequentialNumber: 17,
    lines: [
      { description: "Item 0%", quantity: 1, unitPrice: 100, discountAmount: 0, subtotal: 100, taxRate: 0, taxAmount: 0 },
      { description: "Item 5%", quantity: 1, unitPrice: 100, discountAmount: 0, subtotal: 100, taxRate: 5, taxAmount: 5 },
      { description: "Item 15%", quantity: 1, unitPrice: 100, discountAmount: 0, subtotal: 100, taxRate: 15, taxAmount: 15 },
    ],
    subtotal: 300, discountTotal: 0, taxTotal: 20, grandTotal: 320, sriPaymentCode: "20",
  });

  assert.ok(xml.includes("<codigoPorcentaje>0</codigoPorcentaje>"));
  assert.ok(xml.includes("<codigoPorcentaje>5</codigoPorcentaje>"));
  assert.ok(xml.includes("<codigoPorcentaje>4</codigoPorcentaje>"));
  const totalImpuestoCount = (xml.match(/<totalImpuesto>/g) || []).length;
  assert.equal(totalImpuestoCount, 3);
});

// =====================================================================
// PART E: XML Parser enhancements
// =====================================================================

test("E01 – parsePurchaseXml extracts xmlProductCode (codigoPrincipal)", () => {
  const xml = `
    <factura>
      <infoTributaria>
        <claveAcceso>KEY001</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Test</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial>
        <codDoc>01</codDoc>
      </infoTributaria>
      <infoFactura>
        <fechaEmision>07/10/2026</fechaEmision>
        <identificacionComprador>0992876543001</identificacionComprador>
        <totalSinImpuestos>100.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>115.00</importeTotal>
      </infoFactura>
      <detalles>
        <detalle>
          <codigoPrincipal>PROD-001</codigoPrincipal>
          <descripcion>Producto con código</descripcion>
          <cantidad>1</cantidad>
          <precioUnitario>100.00</precioUnitario>
          <descuento>0.00</descuento>
          <precioTotalSinImpuesto>100.00</precioTotalSinImpuesto>
        </detalle>
      </detalles>
    </factura>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.items[0]!.xmlProductCode, "PROD-001");
});

test("E02 – parsePurchaseXml xmlProductCode is null when codigoPrincipal absent", () => {
  const xml = `
    <factura>
      <infoTributaria>
        <claveAcceso>KEY002</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Test</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000002</secuencial>
        <codDoc>01</codDoc>
      </infoTributaria>
      <infoFactura>
        <fechaEmision>07/10/2026</fechaEmision>
        <identificacionComprador>0992876543001</identificacionComprador>
        <totalSinImpuestos>50.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>50.00</importeTotal>
      </infoFactura>
      <detalles>
        <detalle>
          <descripcion>Sin código</descripcion>
          <cantidad>1</cantidad>
          <precioUnitario>50.00</precioUnitario>
          <descuento>0.00</descuento>
          <precioTotalSinImpuesto>50.00</precioTotalSinImpuesto>
        </detalle>
      </detalles>
    </factura>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.items[0]!.xmlProductCode, null);
});

test("E03 – parsePurchaseXml extracts propina (tip)", () => {
  const xml = `
    <factura>
      <infoTributaria>
        <claveAcceso>KEY003</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Test</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000003</secuencial>
        <codDoc>01</codDoc>
      </infoTributaria>
      <infoFactura>
        <fechaEmision>07/10/2026</fechaEmision>
        <identificacionComprador>0992876543001</identificacionComprador>
        <totalSinImpuestos>100.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <propina>5.00</propina>
        <importeTotal>120.00</importeTotal>
      </infoFactura>
      <detalles>
        <detalle><descripcion>Item</descripcion><cantidad>1</cantidad><precioUnitario>100.00</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>100.00</precioTotalSinImpuesto></detalle>
      </detalles>
    </factura>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.tipAmount, 5);
});

test("E04 – parsePurchaseXml extracts sriPaymentCode from formaPago", () => {
  const xml = `
    <factura>
      <infoTributaria>
        <claveAcceso>KEY004</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Test</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000004</secuencial>
        <codDoc>01</codDoc>
      </infoTributaria>
      <infoFactura>
        <fechaEmision>07/10/2026</fechaEmision>
        <identificacionComprador>0992876543001</identificacionComprador>
        <totalSinImpuestos>100.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>115.00</importeTotal>
        <pagos>
          <pago>
            <formaPago>20</formaPago>
            <total>115.00</total>
          </pago>
        </pagos>
      </infoFactura>
      <detalles>
        <detalle><descripcion>Item</descripcion><cantidad>1</cantidad><precioUnitario>100.00</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>100.00</precioTotalSinImpuesto></detalle>
      </detalles>
    </factura>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.sriPaymentCode, "20");
});

test("E05 – parsePurchaseXml parses infoLiquidacionCompra for settlements", () => {
  const xml = `
    <liquidacionCompra>
      <infoTributaria>
        <claveAcceso>KEY005</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Empresa</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial>
        <codDoc>03</codDoc>
      </infoTributaria>
      <infoLiquidacionCompra>
        <fechaEmision>07/10/2026</fechaEmision>
        <totalSinImpuestos>200.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>200.00</importeTotal>
      </infoLiquidacionCompra>
      <detalles>
        <detalle><descripcion>Frutas</descripcion><cantidad>20</cantidad><precioUnitario>10.00</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>200.00</precioTotalSinImpuesto></detalle>
      </detalles>
    </liquidacionCompra>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.documentType, "PURCHASE_SETTLEMENT");
  assert.equal(result.total, 200);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.description, "Frutas");
});

test("E06 – parsePurchaseXml parses infoNotaCredito for credit notes", () => {
  const xml = `
    <notaCredito>
      <infoTributaria>
        <claveAcceso>KEY006</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Test</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial>
        <codDoc>04</codDoc>
      </infoTributaria>
      <infoNotaCredito>
        <fechaEmision>07/10/2026</fechaEmision>
        <totalSinImpuestos>50.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>57.50</importeTotal>
      </infoNotaCredito>
      <detalles>
        <detalle><descripcion>Devolución</descripcion><cantidad>1</cantidad><precioUnitario>50.00</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>50.00</precioTotalSinImpuesto></detalle>
      </detalles>
    </notaCredito>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.documentType, "CREDIT_NOTE");
  assert.equal(result.total, 57.50);
});

test("E07 – parsePurchaseXml parses infoNotaDebito for debit notes", () => {
  const xml = `
    <notaDebito>
      <infoTributaria>
        <claveAcceso>KEY007</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Test</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial>
        <codDoc>05</codDoc>
      </infoTributaria>
      <infoNotaDebito>
        <fechaEmision>07/10/2026</fechaEmision>
        <totalSinImpuestos>30.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>34.50</importeTotal>
      </infoNotaDebito>
      <detalles>
        <detalle><descripcion>Cargo adicional</descripcion><cantidad>1</cantidad><precioUnitario>30.00</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>30.00</precioTotalSinImpuesto></detalle>
      </detalles>
    </notaDebito>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.documentType, "DEBIT_NOTE");
  assert.equal(result.total, 34.50);
});

test("E08 – parsePurchaseXml parses tax categories: ICE, 0%, 5%, 15%, noTax, exempt", () => {
  const xml = `
    <factura>
      <infoTributaria>
        <claveAcceso>KEY008</claveAcceso>
        <ruc>1790012345001</ruc><razonSocial>Test</razonSocial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000008</secuencial>
        <codDoc>01</codDoc>
      </infoTributaria>
      <infoFactura>
        <fechaEmision>07/10/2026</fechaEmision>
        <identificacionComprador>0992876543001</identificacionComprador>
        <totalSinImpuestos>600.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>645.00</importeTotal>
        <totalConImpuestos>
          <totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><baseImponible>100.00</baseImponible><valor>0.00</valor></totalImpuesto>
          <totalImpuesto><codigo>2</codigo><codigoPorcentaje>5</codigoPorcentaje><baseImponible>100.00</baseImponible><valor>5.00</valor></totalImpuesto>
          <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje><baseImponible>100.00</baseImponible><valor>15.00</valor></totalImpuesto>
          <totalImpuesto><codigo>2</codigo><codigoPorcentaje>6</codigoPorcentaje><baseImponible>100.00</baseImponible><valor>0.00</valor></totalImpuesto>
          <totalImpuesto><codigo>2</codigo><codigoPorcentaje>7</codigoPorcentaje><baseImponible>100.00</baseImponible><valor>0.00</valor></totalImpuesto>
          <totalImpuesto><codigo>3</codigo><codigoPorcentaje>1</codigoPorcentaje><baseImponible>100.00</baseImponible><valor>25.00</valor></totalImpuesto>
        </totalConImpuestos>
      </infoFactura>
      <detalles>
        <detalle><descripcion>Item</descripcion><cantidad>1</cantidad><precioUnitario>600.00</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>600.00</precioTotalSinImpuesto></detalle>
      </detalles>
    </factura>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.subtotal0, 100);
  assert.equal(result.subtotal5, 100);
  assert.equal(result.subtotal15, 100);
  assert.equal(result.subtotalNoTax, 100);
  assert.equal(result.subtotalExempt, 100);
  assert.equal(result.iceTotal, 25);
  assert.equal(result.ivaTotal, 20);
});

test("E09 – parsePurchaseXml extracts tradeName", () => {
  const xml = `
    <factura>
      <infoTributaria>
        <claveAcceso>KEY009</claveAcceso>
        <ruc>1790012345001</ruc>
        <razonSocial>Razón Social S.A.</razonSocial>
        <nombreComercial>Nombre Comercial</nombreComercial>
        <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000009</secuencial>
        <codDoc>01</codDoc>
      </infoTributaria>
      <infoFactura>
        <fechaEmision>07/10/2026</fechaEmision>
        <identificacionComprador>0992876543001</identificacionComprador>
        <totalSinImpuestos>10.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        <importeTotal>10.00</importeTotal>
      </infoFactura>
      <detalles>
        <detalle><descripcion>X</descripcion><cantidad>1</cantidad><precioUnitario>10.00</precioUnitario><descuento>0.00</descuento><precioTotalSinImpuesto>10.00</precioTotalSinImpuesto></detalle>
      </detalles>
    </factura>
  `;
  const result = parsePurchaseXml(xml);
  assert.equal(result.tradeName, "Nombre Comercial");
});

// =====================================================================
// PART F: SRI Sync Adapter
// =====================================================================

test("F01 – SriPurchaseSourceAdapter requires tenantId constructor", () => {
  const adapter = new SriPurchaseSourceAdapter("tenant-abc");
  assert.ok(adapter instanceof SriPurchaseSourceAdapter);
});

test("F02 – SriPurchaseSourceAdapter.fetchReceivedDocuments delegates to worker", async () => {
  const adapter = new SriPurchaseSourceAdapter("tenant-abc");
  await assert.rejects(
    () => adapter.fetchReceivedDocuments({ from: new Date(), to: new Date() }),
    (err: Error) => err.message.includes("worker"),
  );
});

test("F03 – SriPurchaseSourceAdapter.downloadXml delegates to worker", async () => {
  const adapter = new SriPurchaseSourceAdapter("tenant-abc");
  await assert.rejects(
    () => adapter.downloadXml("ref-123"),
    (err: Error) => err.message.includes("worker"),
  );
});

test("F04 – getAdapterForTenant('sri') returns SriPurchaseSourceAdapter", () => {
  const adapter = getAdapterForTenant("tenant-x", "sri");
  assert.ok(adapter instanceof SriPurchaseSourceAdapter);
});

test("F05 – getAdapterForTenant(null provider) returns ManualXmlPurchaseSourceAdapter", () => {
  const adapter = getAdapterForTenant("tenant-x");
  assert.ok(!(adapter instanceof SriPurchaseSourceAdapter));
});
