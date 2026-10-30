import "@/lib/security/server-only";
import { buildSriAccessKey, createStableNumericCode } from "./sri-access-key";
import { mapCustomerIdentificationTypeToSri } from "@/lib/core/customer-fiscal";
import { formatEcuadorSriDate } from "./sri-ecuador-date";
import {
  xmlEscape,
  FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC,
  FACTUROM_SYSTEM_NAME,
  buildSriDocumentDisplayNumber,
} from "./sri-xml";

export type SriCreditNoteXmlParams = {
  documentId: string;
  persistedAccessKey?: string | null;
  profile: {
    legalName: string;
    tradeName: string | null;
    ruc: string;
    environment: "TEST" | "PRODUCTION";
    accountingRequired: boolean;
    taxRegimeCode?: string | null;
    contribuyenteRimpe?: string | null;
    dirMatriz?: string | null;
    companyEmail?: string | null;
    companyPhone?: string | null;
  };
  establishment: { code: string; name: string; address: string };
  issuePoint: { code: string };
  sequentialNumber: number;
  sourceInvoice: {
    displayNumber: string;
    issuedAt: Date;
  };
  document: {
    customerName: string;
    customerIdentification: string | null;
    customerIdentificationType?: "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID" | null;
    customerEmail?: string | null;
    customerAddress?: string | null;
    reason: string;
    subtotal: string | number;
    taxTotal: string | number;
    grandTotal: string | number;
    issuedAt: Date | null;
    createdAt: Date;
  };
  lines: Array<{
    itemName: string;
    itemCode: string | null;
    quantity: string | number;
    unitPrice: string | number;
    discountAmount: string | number;
    subtotal: string | number;
    taxRate: string | number;
    taxAmount: string | number;
    taxCategory?: "TAXABLE" | "ZERO" | "NON_OBJECT" | "EXEMPT" | null;
  }>;
};

function pad(n: number, digits: number): string {
  return String(n).padStart(digits, "0");
}

function dec(value: string | number, digits = 2): string {
  return Number(value).toFixed(digits);
}

function resolveIdentificacion(
  identification: string | null,
  identificationType?: "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID" | null,
): { tipo: string; valor: string } {
  if (!identification?.trim()) return { tipo: "07", valor: "9999999999999" };
  const value = identification.trim();
  if (value === "9999999999999") return { tipo: "07", valor: value };
  if (!identificationType) {
    if (/^\d{13}$/.test(value)) return { tipo: "04", valor: value };
    if (/^\d{10}$/.test(value)) return { tipo: "05", valor: value };
    return { tipo: "06", valor: value };
  }
  return { tipo: mapCustomerIdentificationTypeToSri(identificationType), valor: value };
}

function resolveIvaCodigoPorcentaje(
  taxRate: number,
  taxCategory?: "TAXABLE" | "ZERO" | "NON_OBJECT" | "EXEMPT" | null,
): string {
  if (taxCategory === "NON_OBJECT") return "6";
  if (taxCategory === "EXEMPT") return "7";
  if (taxRate === 0) return "0";
  if (taxRate === 5) return "5";
  if (taxRate === 12) return "2";
  if (taxRate === 15) return "4";
  return "2";
}

function resolveAmbiente(env: "TEST" | "PRODUCTION"): string {
  return env === "PRODUCTION" ? "2" : "1";
}

export function buildUnsignedSriCreditNoteXml(params: SriCreditNoteXmlParams) {
  const displayNumber = buildSriDocumentDisplayNumber(
    params.establishment.code,
    params.issuePoint.code,
    params.sequentialNumber,
  );

  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (!params.profile.ruc || !/^\d{13}$/.test(params.profile.ruc)) {
    missingFields.push("RUC del emisor debe tener 13 dígitos.");
  }
  if (params.lines.length === 0) {
    missingFields.push("La nota de crédito debe tener al menos una línea.");
  }

  const ambiente = resolveAmbiente(params.profile.environment);
  const fechaEmision = formatEcuadorSriDate(params.document.issuedAt ?? params.document.createdAt);
  const { tipo: tipoIdComprador, valor: idComprador } = resolveIdentificacion(
    params.document.customerIdentification,
    params.document.customerIdentificationType,
  );

  const linesXml = params.lines.map((line) => {
    const codigoPrincipal = xmlEscape((line.itemCode ?? "SIN-CODIGO").trim());
    const taxRate = Number(line.taxRate);
    const codigoPct = resolveIvaCodigoPorcentaje(taxRate, line.taxCategory);
    return `    <detalle>
      <codigoInterno>${codigoPrincipal}</codigoInterno>
      <descripcion>${xmlEscape(line.itemName)}</descripcion>
      <cantidad>${dec(line.quantity, 4)}</cantidad>
      <precioUnitario>${dec(line.unitPrice, 4)}</precioUnitario>
      <descuento>${dec(line.discountAmount)}</descuento>
      <precioTotalSinImpuesto>${dec(line.subtotal)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${codigoPct}</codigoPorcentaje>
          <tarifa>${dec(taxRate)}</tarifa>
          <baseImponible>${dec(line.subtotal)}</baseImponible>
          <valor>${dec(line.taxAmount)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
  }).join("\n");

  const taxMap = new Map<string, { codigoPorcentaje: string; baseImponible: number; valor: number }>();
  for (const line of params.lines) {
    const rate = Number(line.taxRate);
    const cp = resolveIvaCodigoPorcentaje(rate, line.taxCategory);
    const existing = taxMap.get(cp);
    if (existing) {
      existing.baseImponible += Number(line.subtotal);
      existing.valor += Number(line.taxAmount);
    } else {
      taxMap.set(cp, { codigoPorcentaje: cp, baseImponible: Number(line.subtotal), valor: Number(line.taxAmount) });
    }
  }

  const taxGroupsXml = Array.from(taxMap.values())
    .map((g) => `      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${g.codigoPorcentaje}</codigoPorcentaje>
        <baseImponible>${dec(g.baseImponible)}</baseImponible>
        <valor>${dec(g.valor)}</valor>
      </totalImpuesto>`)
    .join("\n");

  let accessKey: string | null = null;
  let claveAcceso = "PENDIENTE_DE_GENERAR";

  if (params.persistedAccessKey) {
    accessKey = params.persistedAccessKey;
    claveAcceso = params.persistedAccessKey;
  } else if (missingFields.length === 0) {
    try {
      const numericCode = createStableNumericCode(params.documentId);
      const keyResult = buildSriAccessKey({
        issuedAt: params.document.issuedAt ?? params.document.createdAt,
        documentType: "CREDIT_NOTE",
        ruc: params.profile.ruc,
        environment: params.profile.environment,
        establishmentCode: params.establishment.code,
        issuePointCode: params.issuePoint.code,
        sequentialNumber: params.sequentialNumber,
        numericCode,
      });
      accessKey = keyResult.accessKey;
      claveAcceso = keyResult.accessKey;
    } catch {
      warnings.push("No se pudo generar la clave de acceso.");
    }
  }

  const dirMatriz = xmlEscape(params.profile.dirMatriz ?? params.establishment.address);
  const contribuyenteRimpeXml = params.profile.contribuyenteRimpe
    && ["RIMPE_EMPRENDEDOR", "RIMPE_NEGOCIO_POPULAR"].includes(params.profile.taxRegimeCode ?? "")
    ? `\n    <contribuyenteRimpe>${xmlEscape(params.profile.contribuyenteRimpe)}</contribuyenteRimpe>`
    : "";

  const additionalValues: Array<[string, string | null | undefined]> = [
    ["RUC PROVEEDOR FACTURACIÓN ELECTRONICA", FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC],
    ["SISTEMA", FACTUROM_SYSTEM_NAME],
    ["EMAIL EMPRESA", params.profile.companyEmail],
    ["EMAIL CLIENTE", params.document.customerEmail],
    ["DIRECCION CLIENTE", params.document.customerAddress],
  ];
  const infoAdicionalItems = additionalValues
    .filter((item): item is [string, string] => Boolean(item[1]?.trim()))
    .map(([name, value]) => `    <campoAdicional nombre="${xmlEscape(name)}">${xmlEscape(value)}</campoAdicional>`);
  const infoAdicionalXml = infoAdicionalItems.length > 0
    ? `\n  <infoAdicional>\n${infoAdicionalItems.join("\n")}\n  </infoAdicional>`
    : "";

  const fechaEmisionDocSustento = formatEcuadorSriDate(params.sourceInvoice.issuedAt);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XML PRELIMINAR — NO FIRMADO — SIN VALIDEZ TRIBUTARIA -->
<notaCredito id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xmlEscape(params.profile.legalName)}</razonSocial>
    <nombreComercial>${xmlEscape(params.profile.tradeName ?? params.profile.legalName)}</nombreComercial>
    <ruc>${xmlEscape(params.profile.ruc)}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>04</codDoc>
    <estab>${xmlEscape(params.establishment.code)}</estab>
    <ptoEmi>${xmlEscape(params.issuePoint.code)}</ptoEmi>
    <secuencial>${pad(params.sequentialNumber, 9)}</secuencial>
    <dirMatriz>${dirMatriz}</dirMatriz>${contribuyenteRimpeXml}
  </infoTributaria>
  <infoNotaCredito>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${xmlEscape(params.establishment.address)}</dirEstablecimiento>
    <tipoIdentificacionComprador>${tipoIdComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${xmlEscape(params.document.customerName)}</razonSocialComprador>
    <identificacionComprador>${xmlEscape(idComprador)}</identificacionComprador>
    <obligadoContabilidad>${params.profile.accountingRequired ? "SI" : "NO"}</obligadoContabilidad>
    <codDocModificado>01</codDocModificado>
    <numDocModificado>${xmlEscape(params.sourceInvoice.displayNumber)}</numDocModificado>
    <fechaEmisionDocSustento>${fechaEmisionDocSustento}</fechaEmisionDocSustento>
    <totalSinImpuestos>${dec(params.document.subtotal)}</totalSinImpuestos>
    <valorModificacion>${dec(params.document.grandTotal)}</valorModificacion>
    <moneda>DOLAR</moneda>
    <totalConImpuestos>
${taxGroupsXml}
    </totalConImpuestos>
    <motivo>${xmlEscape(params.document.reason)}</motivo>
  </infoNotaCredito>
  <detalles>
${linesXml}
  </detalles>${infoAdicionalXml}
</notaCredito>`;

  return { xml, displayNumber, warnings, missingFields, accessKey, numberingPersisted: Boolean(params.persistedAccessKey) };
}
