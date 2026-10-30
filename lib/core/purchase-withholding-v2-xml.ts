import "@/lib/security/server-only";
import { xmlEscape, FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC, FACTUROM_SYSTEM_NAME } from "./sri-xml";
import { formatEcuadorSriDate } from "./sri-ecuador-date";

export type WithholdingV2XmlParams = {
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
  supportDocuments: Array<{
    codSustento: string;
    codDocSustento: string;
    numDocSustento: string;
    fechaEmisionDocSustento: Date;
    fechaRegistroContable: Date;
    numAutDocSustento: string;
    pagoLocExt: string;
    totalSinImpuestos: number;
    importeTotal: number;
    taxes: Array<{
      codImpuestoDocSustento: string;
      codigoPorcentaje: string;
      baseImponible: number;
      tarifa: number;
      valorImpuesto: number;
    }>;
    retentions: Array<{
      codigo: string;
      codigoRetencion: string;
      baseImponible: number;
      porcentajeRetener: number;
      valorRetenido: number;
    }>;
    payments: Array<{
      formaPago: string;
      total: number;
    }>;
  }>;
  additionalInfo?: Array<{ name: string; value: string }>;
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

export function buildWithholdingV2Xml(params: WithholdingV2XmlParams): string {
  const {
    profile,
    establishment,
    issuePoint,
    sequentialNumber,
    accessKey,
    issuedAt,
    supplier,
    fiscalPeriod,
    supportDocuments,
    additionalInfo,
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

  const docsSustentoXml = supportDocuments.map((doc) => {
    const taxesXml = doc.taxes.map((t) =>
      `          <impuestoDocSustento>
            <codImpuestoDocSustento>${xmlEscape(t.codImpuestoDocSustento)}</codImpuestoDocSustento>
            <codigoPorcentaje>${xmlEscape(t.codigoPorcentaje)}</codigoPorcentaje>
            <baseImponible>${dec(t.baseImponible)}</baseImponible>
            <tarifa>${dec(t.tarifa)}</tarifa>
            <valorImpuesto>${dec(t.valorImpuesto)}</valorImpuesto>
          </impuestoDocSustento>`
    ).join("\n");

    const retentionsXml = doc.retentions.map((r) =>
      `          <retencion>
            <codigo>${xmlEscape(r.codigo)}</codigo>
            <codigoRetencion>${xmlEscape(r.codigoRetencion)}</codigoRetencion>
            <baseImponible>${dec(r.baseImponible)}</baseImponible>
            <porcentajeRetener>${dec(r.porcentajeRetener)}</porcentajeRetener>
            <valorRetenido>${dec(r.valorRetenido)}</valorRetenido>
          </retencion>`
    ).join("\n");

    const paymentsXml = doc.payments.length > 0
      ? `\n        <pagos>\n${doc.payments.map((p) =>
          `          <pago>
            <formaPago>${xmlEscape(p.formaPago)}</formaPago>
            <total>${dec(p.total)}</total>
          </pago>`
        ).join("\n")}\n        </pagos>`
      : "";

    return `      <docSustento>
        <codSustento>${xmlEscape(doc.codSustento)}</codSustento>
        <codDocSustento>${xmlEscape(doc.codDocSustento)}</codDocSustento>
        <numDocSustento>${xmlEscape(doc.numDocSustento)}</numDocSustento>
        <fechaEmisionDocSustento>${formatEcuadorSriDate(doc.fechaEmisionDocSustento)}</fechaEmisionDocSustento>
        <fechaRegistroContable>${formatEcuadorSriDate(doc.fechaRegistroContable)}</fechaRegistroContable>
        <numAutDocSustento>${xmlEscape(doc.numAutDocSustento)}</numAutDocSustento>
        <pagoLocExt>${xmlEscape(doc.pagoLocExt)}</pagoLocExt>
        <totalSinImpuestos>${dec(doc.totalSinImpuestos)}</totalSinImpuestos>
        <importeTotal>${dec(doc.importeTotal)}</importeTotal>
        <impuestosDocSustento>
${taxesXml}
        </impuestosDocSustento>
        <retenciones>
${retentionsXml}
        </retenciones>${paymentsXml}
      </docSustento>`;
  }).join("\n");

  const infoAdicionalItems: string[] = [];
  if (additionalInfo) {
    for (const ai of additionalInfo) {
      infoAdicionalItems.push(
        `    <campoAdicional nombre="${xmlEscape(ai.name)}">${xmlEscape(ai.value)}</campoAdicional>`,
      );
    }
  }
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
<comprobanteRetencion id="comprobante" version="2.0.0">
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
  <docsSustento>
${docsSustentoXml}
  </docsSustento>${infoAdicionalXml}
</comprobanteRetencion>`;
}
