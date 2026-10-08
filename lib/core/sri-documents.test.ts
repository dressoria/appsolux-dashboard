import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";

import { parseAuthorizedSriInvoiceXml } from "./sri-authorized-xml-parser";
import { generateRidePdfFromAuthorizedXml } from "./sri-ride-generator";
import {
  buildUnsignedSriInvoiceXmlPreview,
  FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC,
  FACTUROM_SYSTEM_NAME,
} from "./sri-xml";
import {
  buildSriAccessKey,
  accessKeyMatchesEcuadorIssueDate,
  formatSriDateForAccessKey,
} from "./sri-access-key";
import { formatEcuadorSriDate } from "./sri-ecuador-date";

function buildXml(profileOverrides: {
  accountingRequired?: boolean;
  taxRegimeCode?: string | null;
  contribuyenteRimpe?: string | null;
} = {}, issuedAt = new Date("2026-10-07T12:00:00-05:00")) {
  return buildUnsignedSriInvoiceXmlPreview({
    documentId: "invoice-test",
    profile: {
      legalName: "Empresa & Asociados",
      tradeName: "Empresa <EC>",
      ruc: "1790012345001",
      environment: "PRODUCTION",
      accountingRequired: profileOverrides.accountingRequired ?? true,
      taxRegimeCode: profileOverrides.taxRegimeCode ?? "RIMPE_EMPRENDEDOR",
      contribuyenteRimpe:
        profileOverrides.contribuyenteRimpe ?? "CONTRIBUYENTE RÉGIMEN RIMPE",
      dirMatriz: "Quito <Centro>",
      companyEmail: "empresa@example.com",
      companyPhone: "022345678",
    },
    establishment: { code: "001", name: "Matriz", address: "Quito" },
    issuePoint: { code: "001" },
    sequentialNumber: 1,
    document: {
      documentType: "INVOICE",
      customerName: "Cliente & Compañía",
      customerIdentification: "1712345678",
      customerIdentificationType: "CEDULA",
      customerEmail: "cliente@example.com",
      customerPhone: "0999999999",
      customerAddress: "Av. A & Calle <B>",
      commercialPaymentMethod: "transfer",
      subtotal: 10,
      taxTotal: 1.5,
      discountTotal: 0,
      grandTotal: 11.5,
      sriPaymentCode: "20",
      issuedAt,
      createdAt: issuedAt,
    },
    lines: [
      {
        itemName: "Servicio & soporte",
        itemCode: "SERV-1",
        quantity: 1,
        unitPrice: 10,
        discountAmount: 0,
        subtotal: 10,
        taxRate: 15,
        taxAmount: 1.5,
      },
    ],
  }).xml;
}

test("XML incluye información adicional Facturom escapada y separa forma comercial", () => {
  const xml = buildXml();
  assert.match(xml, /<infoAdicional>/);
  assert.match(xml, new RegExp(FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC));
  assert.match(xml, new RegExp(FACTUROM_SYSTEM_NAME));
  assert.match(xml, /EMAIL EMPRESA[^>]*>empresa@example\.com/);
  assert.match(xml, /TELEFONO EMPRESA[^>]*>022345678/);
  assert.match(xml, /EMAIL CLIENTE[^>]*>cliente@example\.com/);
  assert.match(xml, /TELEFONO CLIENTE[^>]*>0999999999/);
  assert.match(xml, /FORMA PAGO[^>]*>TRANSFERENCIA/);
  assert.match(xml, /<formaPago>20<\/formaPago>/);
  assert.match(xml, /CONTRIBUYENTE RÉGIMEN RIMPE/);
  assert.match(xml, /Cliente &amp; Compañía/);
  assert.doesNotMatch(xml, /undefined|null|CONTAMATIC/i);
});

test("RIDE usa fecha y pago del XML autorizado y genera PDF real", async () => {
  const documentXml = buildXml()
    .replace(/<\?xml[^>]*>|<!--[^]*?-->/g, "")
    .trim();
  const authorized = `<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>0710202601179001234500110010010000000011234567811</numeroAutorizacion><fechaAutorizacion>07/10/2026 12:34:56</fechaAutorizacion><comprobante><![CDATA[${documentXml}]]></comprobante></autorizacion>`;
  const parsed = parseAuthorizedSriInvoiceXml(authorized);
  assert.equal(parsed.authorization.date, "07/10/2026 12:34:56");
  assert.notEqual(parsed.authorization.date, "PENDIENTE");
  assert.deepEqual(parsed.payments[0], {
    code: "20",
    label: "Otros con utilización del sistema financiero",
    amount: "11.50",
    term: "0",
    timeUnit: "dias",
  });
  assert.equal(
    parsed.additionalFields.find((field) => field.name === "REGIMEN")?.value,
    "CONTRIBUYENTE RÉGIMEN RIMPE",
  );
  const pdf = await generateRidePdfFromAuthorizedXml(parsed);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 2000);
  if (process.env.RIDE_TEST_OUTPUT) {
    await writeFile(process.env.RIDE_TEST_OUTPUT, pdf);
  }
});

test("régimen general solo aparece en información adicional", () => {
  const xml = buildXml({
    taxRegimeCode: "REGIMEN_GENERAL",
    contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN GENERAL",
  });
  assert.doesNotMatch(xml, /<contribuyenteRimpe>/);
  assert.match(
    xml,
    /<campoAdicional nombre="REGIMEN">CONTRIBUYENTE RÉGIMEN GENERAL<\/campoAdicional>/,
  );
});

test("RIMPE ubica contribuyenteRimpe en infoTributaria y respeta orden SRI", () => {
  const xml = buildXml();
  const infoTributaria = xml.match(/<infoTributaria>([\s\S]*?)<\/infoTributaria>/)?.[1] ?? "";
  const infoFactura = xml.match(/<infoFactura>([\s\S]*?)<\/infoFactura>/)?.[1] ?? "";
  assert.match(infoTributaria, /<dirMatriz>[\s\S]*<contribuyenteRimpe>/);
  assert.doesNotMatch(infoFactura, /<contribuyenteRimpe>/);
  assert.ok(infoFactura.indexOf("<obligadoContabilidad>") < infoFactura.indexOf("<tipoIdentificacionComprador>"));
});

test("obligadoContabilidad refleja exactamente el perfil sincronizado", () => {
  assert.match(buildXml({ accountingRequired: false }), /<obligadoContabilidad>NO<\/obligadoContabilidad>/);
  assert.match(buildXml({ accountingRequired: true }), /<obligadoContabilidad>SI<\/obligadoContabilidad>/);
});

test("fecha XML y clave usan el mismo día fiscal America/Guayaquil", () => {
  const beforeMidnight = new Date("2026-10-08T04:39:00.000Z");
  const afterMidnight = new Date("2026-10-08T05:01:00.000Z");
  assert.equal(formatEcuadorSriDate(beforeMidnight), "07/10/2026");
  assert.equal(formatSriDateForAccessKey(beforeMidnight), "07102026");
  assert.equal(formatSriDateForAccessKey(afterMidnight), "08102026");

  const result = buildSriAccessKey({
    issuedAt: beforeMidnight,
    documentType: "INVOICE",
    ruc: "1790012345001",
    environment: "PRODUCTION",
    establishmentCode: "001",
    issuePointCode: "001",
    sequentialNumber: 307,
    numericCode: "12345678",
  });
  assert.ok(result.accessKey.startsWith("07102026"));
  assert.equal(
    accessKeyMatchesEcuadorIssueDate(result.accessKey, beforeMidnight),
    true,
  );
  assert.equal(
    accessKeyMatchesEcuadorIssueDate(result.accessKey, afterMidnight),
    false,
  );

  const xml = buildXml({}, beforeMidnight);
  const xmlDate = xml.match(/<fechaEmision>([^<]+)<\/fechaEmision>/)?.[1];
  const xmlAccessKey = xml.match(/<claveAcceso>(\d{49})<\/claveAcceso>/)?.[1];
  assert.equal(xmlDate, "07/10/2026");
  assert.equal(xmlAccessKey?.slice(0, 8), xmlDate?.replaceAll("/", ""));
});

test("ajustes UI mantienen overflow y select contenido", async () => {
  const [invoiceEditor, proformaEditor] = await Promise.all([
    readFile(
      new URL(
        "../../components/appsolux/sales/invoice-editor.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../components/appsolux/sales/proforma-editor.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(invoiceEditor, /min-w-0 w-full truncate/);
  assert.match(invoiceEditor, /title=\{/);
  assert.match(proformaEditor, /overflow-x-auto/);
  assert.match(proformaEditor, /min-w-\[1180px\]/);
  assert.match(proformaEditor, /Desc\. %/);
});
