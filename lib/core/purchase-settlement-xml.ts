import "@/lib/security/server-only";
import { xmlEscape, FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC, FACTUROM_SYSTEM_NAME } from "./sri-xml";
import { formatEcuadorSriDate } from "./sri-ecuador-date";

export type SettlementXmlParams = {
  documentId: string;
  accessKey: string;
  profile: {
    legalName: string;
    tradeName: string | null;
    ruc: string;
    environment: "TEST" | "PRODUCTION";
    accountingRequired: boolean;
    dirMatriz?: string | null;
    contribuyenteRimpe?: string | null;
    taxRegimeCode?: string | null;
    companyEmail?: string | null;
    companyPhone?: string | null;
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
    address?: string | null;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
  }>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  sriPaymentCode: string;
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

function resolveIvaCodigoPorcentaje(taxRate: number): string {
  if (taxRate === 0) return "0";
  if (taxRate === 5) return "5";
  if (taxRate === 8) return "8";
  if (taxRate === 12) return "2";
  if (taxRate === 15) return "4";
  throw new Error(`Tarifa IVA no soportada: ${taxRate}%. Verifique los datos del documento.`);
}

export function buildSettlementXml(params: SettlementXmlParams): string {
  const {
    profile,
    establishment,
    issuePoint,
    sequentialNumber,
    accessKey,
    issuedAt,
    supplier,
    lines,
  } = params;

  const ambiente = profile.environment === "PRODUCTION" ? "2" : "1";
  const fechaEmision = formatEcuadorSriDate(issuedAt);
  const { tipo: tipoIdProveedor, valor: idProveedor } = resolveIdentificacion(
    supplier.identification,
    supplier.identificationType,
  );
  const dirMatriz = xmlEscape(profile.dirMatriz ?? establishment.address);

  const contribuyenteRimpeXml =
    profile.contribuyenteRimpe &&
    ["RIMPE_EMPRENDEDOR", "RIMPE_NEGOCIO_POPULAR"].includes(profile.taxRegimeCode ?? "")
      ? `\n    <contribuyenteRimpe>${xmlEscape(profile.contribuyenteRimpe)}</contribuyenteRimpe>`
      : "";

  const taxMap = new Map<number, { codigoPorcentaje: string; baseImponible: number; valor: number }>();
  for (const line of lines) {
    const cp = resolveIvaCodigoPorcentaje(line.taxRate);
    const existing = taxMap.get(line.taxRate);
    if (existing) {
      existing.baseImponible += line.subtotal;
      existing.valor += line.taxAmount;
    } else {
      taxMap.set(line.taxRate, { codigoPorcentaje: cp, baseImponible: line.subtotal, valor: line.taxAmount });
    }
  }

  const totalImpuestosXml = Array.from(taxMap.values())
    .map(
      (g) => `      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${g.codigoPorcentaje}</codigoPorcentaje>
        <baseImponible>${dec(g.baseImponible)}</baseImponible>
        <tarifa>${dec(Number(Array.from(taxMap.entries()).find(([, v]) => v === g)?.[0] ?? 0))}</tarifa>
        <valor>${dec(g.valor)}</valor>
      </totalImpuesto>`,
    )
    .join("\n");

  const linesXml = lines
    .map((line) => {
      const cp = resolveIvaCodigoPorcentaje(line.taxRate);
      return `    <detalle>
      <codigoPrincipal>NA</codigoPrincipal>
      <descripcion>${xmlEscape(line.description)}</descripcion>
      <cantidad>${dec(line.quantity, 4)}</cantidad>
      <precioUnitario>${dec(line.unitPrice, 4)}</precioUnitario>
      <descuento>${dec(line.discountAmount)}</descuento>
      <precioTotalSinImpuesto>${dec(line.subtotal)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${cp}</codigoPorcentaje>
          <tarifa>${dec(line.taxRate)}</tarifa>
          <baseImponible>${dec(line.subtotal)}</baseImponible>
          <valor>${dec(line.taxAmount)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`;
    })
    .join("\n");

  const infoAdicionalItems = [
    `    <campoAdicional nombre="RUC PROVEEDOR FACTURACIÓN ELECTRONICA">${FACTUROM_ELECTRONIC_BILLING_PROVIDER_RUC}</campoAdicional>`,
    `    <campoAdicional nombre="SISTEMA">${FACTUROM_SYSTEM_NAME}</campoAdicional>`,
  ];
  if (profile.companyEmail) {
    infoAdicionalItems.push(
      `    <campoAdicional nombre="EMAIL EMPRESA">${xmlEscape(profile.companyEmail)}</campoAdicional>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<liquidacionCompra id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xmlEscape(profile.legalName)}</razonSocial>
    <nombreComercial>${xmlEscape(profile.tradeName ?? profile.legalName)}</nombreComercial>
    <ruc>${xmlEscape(profile.ruc)}</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <codDoc>03</codDoc>
    <estab>${xmlEscape(establishment.code)}</estab>
    <ptoEmi>${xmlEscape(issuePoint.code)}</ptoEmi>
    <secuencial>${pad(sequentialNumber, 9)}</secuencial>
    <dirMatriz>${dirMatriz}</dirMatriz>${contribuyenteRimpeXml}
  </infoTributaria>
  <infoLiquidacionCompra>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${xmlEscape(establishment.address)}</dirEstablecimiento>
    <obligadoContabilidad>${profile.accountingRequired ? "SI" : "NO"}</obligadoContabilidad>
    <tipoIdentificacionProveedor>${tipoIdProveedor}</tipoIdentificacionProveedor>
    <razonSocialProveedor>${xmlEscape(supplier.name)}</razonSocialProveedor>
    <identificacionProveedor>${xmlEscape(idProveedor)}</identificacionProveedor>${supplier.address ? `\n    <direccionProveedor>${xmlEscape(supplier.address)}</direccionProveedor>` : ""}
    <totalSinImpuestos>${dec(params.subtotal)}</totalSinImpuestos>
    <totalDescuento>${dec(params.discountTotal)}</totalDescuento>
    <totalConImpuestos>
${totalImpuestosXml}
    </totalConImpuestos>
    <importeTotal>${dec(params.grandTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>${xmlEscape(params.sriPaymentCode)}</formaPago>
        <total>${dec(params.grandTotal)}</total>
      </pago>
    </pagos>
  </infoLiquidacionCompra>
  <detalles>
${linesXml}
  </detalles>
  <infoAdicional>
${infoAdicionalItems.join("\n")}
  </infoAdicional>
</liquidacionCompra>`;
}
