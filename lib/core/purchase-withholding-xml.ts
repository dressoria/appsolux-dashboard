import "@/lib/security/server-only";
import { xmlEscape, FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC, FACTUROM_SYSTEM_NAME } from "./sri-xml";
import { formatEcuadorSriDate } from "./sri-ecuador-date";

export type WithholdingXmlParams = {
  documentId: string;
  accessKey: string;
  profile: {
    legalName: string;
    tradeName: string | null;
    ruc: string;
    environment: "TEST" | "PRODUCTION";
    accountingRequired: boolean;
    dirMatriz?: string | null;
    specialTaxpayerNumber?: string | null;
    contribuyenteRimpe?: string | null;
    taxRegimeCode?: string | null;
    companyEmail?: string | null;
  };
  establishment: {
    code: string;
    address: string;
  };
  issuePoint: {
    code: string;
  };
  sequentialNumber: number;
  issuedAt: Date;
  supplier: {
    name: string;
    identification: string;
    identificationType?: "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID" | null;
  };
  fiscalPeriod: string;
  lines: Array<{
    taxType: "RENTA" | "IVA";
    code: string;
    taxBase: number;
    percentage: number;
    retainedAmount: number;
    purchaseDocumentNumber?: string | null;
    purchaseDocumentDate?: Date | null;
    purchaseDocumentType?: string;
  }>;
};

function pad(n: number, digits: number): string {
  return String(n).padStart(digits, "0");
}

function dec(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function resolveIdentificacion(
  identification: string,
  identificationType?: "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID" | null,
): { tipo: string; valor: string } {
  if (/^\d{13}$/.test(identification)) return { tipo: "04", valor: identification };
  if (/^\d{10}$/.test(identification)) return { tipo: "05", valor: identification };
  if (identificationType === "RUC") return { tipo: "04", valor: identification };
  if (identificationType === "CEDULA") return { tipo: "05", valor: identification };
  return { tipo: "06", valor: identification };
}

function resolveTaxCode(taxType: "RENTA" | "IVA"): string {
  return taxType === "RENTA" ? "1" : "2";
}

function resolveSupportingDocType(docType?: string): string {
  if (docType === "CREDIT_NOTE") return "04";
  if (docType === "DEBIT_NOTE") return "05";
  return "01";
}

export function buildWithholdingXml(params: WithholdingXmlParams): string {
  const {
    profile,
    establishment,
    issuePoint,
    sequentialNumber,
    accessKey,
    issuedAt,
    supplier,
    fiscalPeriod,
    lines,
  } = params;

  const ambiente = profile.environment === "PRODUCTION" ? "2" : "1";
  const fechaEmision = formatEcuadorSriDate(issuedAt);
  const { tipo: tipoIdRetenido, valor: idRetenido } = resolveIdentificacion(
    supplier.identification,
    supplier.identificationType,
  );
  const dirMatriz = xmlEscape(profile.dirMatriz ?? establishment.address);

  const contribuyenteRimpeXml =
    profile.contribuyenteRimpe &&
    ["RIMPE_EMPRENDEDOR", "RIMPE_NEGOCIO_POPULAR"].includes(profile.taxRegimeCode ?? "")
      ? `\n    <contribuyenteRimpe>${xmlEscape(profile.contribuyenteRimpe)}</contribuyenteRimpe>`
      : "";

  const specialTaxpayerXml = profile.specialTaxpayerNumber
    ? `\n    <contribuyenteEspecial>${xmlEscape(profile.specialTaxpayerNumber)}</contribuyenteEspecial>`
    : "";

  const linesXml = lines
    .map((line) => {
      const codDocSustento = resolveSupportingDocType(line.purchaseDocumentType);
      const numDocSustento = line.purchaseDocumentNumber
        ? xmlEscape(line.purchaseDocumentNumber)
        : "000-000-000000000";
      const fechaDocSustento = line.purchaseDocumentDate
        ? formatEcuadorSriDate(line.purchaseDocumentDate)
        : fechaEmision;

      return `    <impuesto>
      <codigo>${resolveTaxCode(line.taxType)}</codigo>
      <codigoRetencion>${xmlEscape(line.code)}</codigoRetencion>
      <baseImponible>${dec(line.taxBase)}</baseImponible>
      <porcentajeRetener>${dec(line.percentage)}</porcentajeRetener>
      <valorRetenido>${dec(line.retainedAmount)}</valorRetenido>
      <codDocSustento>${codDocSustento}</codDocSustento>
      <numDocSustento>${numDocSustento}</numDocSustento>
      <fechaEmisionDocSustento>${fechaDocSustento}</fechaEmisionDocSustento>
    </impuesto>`;
    })
    .join("\n");

  const infoAdicionalItems: string[] = [];
  if (profile.companyEmail) {
    infoAdicionalItems.push(
      `    <campoAdicional nombre="EMAIL EMPRESA">${xmlEscape(profile.companyEmail)}</campoAdicional>`,
    );
  }
  infoAdicionalItems.push(
    `    <campoAdicional nombre="RUC PROVEEDOR FACTURACIÓN ELECTRONICA">${FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC}</campoAdicional>`,
  );
  infoAdicionalItems.push(
    `    <campoAdicional nombre="SISTEMA">${FACTUROM_SYSTEM_NAME}</campoAdicional>`,
  );

  const infoAdicionalXml =
    infoAdicionalItems.length > 0
      ? `\n  <infoAdicional>\n${infoAdicionalItems.join("\n")}\n  </infoAdicional>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<comprobanteRetencion id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xmlEscape(profile.legalName)}</razonSocial>
    <nombreComercial>${xmlEscape(profile.tradeName ?? profile.legalName)}</nombreComercial>
    <ruc>${xmlEscape(profile.ruc)}</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <codDoc>07</codDoc>
    <estab>${xmlEscape(establishment.code)}</estab>
    <ptoEmi>${xmlEscape(issuePoint.code)}</ptoEmi>
    <secuencial>${pad(sequentialNumber, 9)}</secuencial>
    <dirMatriz>${dirMatriz}</dirMatriz>${contribuyenteRimpeXml}
  </infoTributaria>
  <infoCompRetencion>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${xmlEscape(establishment.address)}</dirEstablecimiento>${specialTaxpayerXml}
    <obligadoContabilidad>${profile.accountingRequired ? "SI" : "NO"}</obligadoContabilidad>
    <tipoIdentificacionSujetoRetenido>${tipoIdRetenido}</tipoIdentificacionSujetoRetenido>
    <razonSocialSujetoRetenido>${xmlEscape(supplier.name)}</razonSocialSujetoRetenido>
    <identificacionSujetoRetenido>${xmlEscape(idRetenido)}</identificacionSujetoRetenido>
    <periodoFiscal>${xmlEscape(fiscalPeriod)}</periodoFiscal>
  </infoCompRetencion>
  <impuestos>
${linesXml}
  </impuestos>${infoAdicionalXml}
</comprobanteRetencion>`;
}
