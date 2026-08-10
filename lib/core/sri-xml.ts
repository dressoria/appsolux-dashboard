import "@/lib/security/server-only";
import { buildSriAccessKey, createStableNumericCode } from "./sri-access-key";
import { mapCustomerIdentificationTypeToSri } from "@/lib/core/customer-fiscal";

export type SriXmlPreviewParams = {
  documentId: string;
  persistedAccessKey?: string | null;
  profile: {
    legalName: string;
    tradeName: string | null;
    ruc: string;
    environment: "TEST" | "PRODUCTION";
    accountingRequired: boolean;
    contribuyenteRimpe?: string | null;
    dirMatriz?: string | null;
  };
  establishment: {
    code: string;
    name: string;
    address: string;
  };
  issuePoint: {
    code: string;
  };
  sequentialNumber: number;
  document: {
    documentType: string;
    customerName: string;
    customerIdentification: string | null;
    customerIdentificationType?: "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID" | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    subtotal: string | number;
    taxTotal: string | number;
    discountTotal: string | number;
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
  }>;
};

export type SriXmlPreviewResult = {
  xml: string;
  displayNumber: string;
  warnings: string[];
  missingFields: string[];
  accessKey: string | null;
  numberingPersisted: boolean;
};

function pad(n: number, digits: number): string {
  return String(n).padStart(digits, "0");
}

function formatDateEC(date: Date): string {
  const d = new Date(date);
  return `${pad(d.getDate(), 2)}/${pad(d.getMonth() + 1, 2)}/${d.getFullYear()}`;
}

function dec(value: string | number, digits = 2): string {
  return Number(value).toFixed(digits);
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveAmbiente(env: "TEST" | "PRODUCTION"): string {
  return env === "PRODUCTION" ? "2" : "1";
}

function resolveIdentificacion(identification: string | null, identificationType?: "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID" | null): {
  tipo: string;
  valor: string;
} {
  if (!identification || !identification.trim()) {
    // Consumidor Final
    return { tipo: "07", valor: "9999999999999" };
  }
  const value = identification.trim();
  if (value === "9999999999999") return { tipo: "07", valor: value };
  if (!identificationType) {
    if (/^\d{13}$/.test(value)) return { tipo: "04", valor: value };
    if (/^\d{10}$/.test(value)) return { tipo: "05", valor: value };
    return { tipo: "06", valor: value };
  }
  return { tipo: mapCustomerIdentificationTypeToSri(identificationType), valor: value };
}

function resolveIvaCodigoPorcentaje(taxRate: number): string {
  if (taxRate === 0) return "0";  // IVA 0%
  if (taxRate === 5) return "5";  // IVA 5% (bienes específicos)
  if (taxRate === 12) return "2"; // IVA 12% (tarifa histórica)
  if (taxRate === 15) return "4"; // IVA 15% (tarifa vigente desde abril 2024)
  return "2";
}

function buildLineXml(line: SriXmlPreviewParams["lines"][number], index: number): string {
  const taxRate = Number(line.taxRate);
  const codigoPct = resolveIvaCodigoPorcentaje(taxRate);
  const codigoPrincipal = line.itemCode ? xmlEscape(line.itemCode) : `ITEM-${pad(index + 1, 3)}`;

  return `    <detalle>
      <codigoPrincipal>${codigoPrincipal}</codigoPrincipal>
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
}

export function buildSriDocumentDisplayNumber(
  estabCode: string,
  issuePointCode: string,
  sequential: number
): string {
  return `${estabCode}-${issuePointCode}-${pad(sequential, 9)}`;
}

export function validateSriDocumentForXmlPreview(params: SriXmlPreviewParams): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.profile.ruc || !/^\d{13}$/.test(params.profile.ruc)) {
    errors.push("RUC del emisor debe tener 13 dígitos.");
  }
  if (!params.profile.legalName.trim()) {
    errors.push("Razón social del emisor es requerida.");
  }
  if (params.lines.length === 0) {
    errors.push("El comprobante debe tener al menos una línea.");
  }
  if (Number(params.document.grandTotal) <= 0) {
    errors.push("El total del comprobante debe ser mayor a 0.");
  }
  if (params.document.documentType !== "INVOICE") {
    errors.push(`Tipo '${params.document.documentType}' no está implementado en esta fase.`);
  }

  if (!params.document.customerIdentification) {
    warnings.push("Cliente sin identificación: se usará Consumidor Final (9999999999999).");
  }
  if (Number(params.document.taxTotal) === 0) {
    warnings.push("IVA es $0.00. El POS básico no registra IVA. Revisa antes de emitir.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function buildUnsignedSriInvoiceXmlPreview(
  params: SriXmlPreviewParams
): SriXmlPreviewResult {
  const displayNumber = buildSriDocumentDisplayNumber(
    params.establishment.code,
    params.issuePoint.code,
    params.sequentialNumber
  );

  const validation = validateSriDocumentForXmlPreview(params);
  const warnings = [...validation.warnings];
  const missingFields = [...validation.errors];

  if (params.document.documentType !== "INVOICE") {
    return {
      xml: `<!-- Tipo de documento '${params.document.documentType}' no implementado todavía en esta fase. -->`,
      displayNumber,
      warnings,
      missingFields,
      accessKey: null,
      numberingPersisted: false,
    };
  }

  const ambiente = resolveAmbiente(params.profile.environment);
  const fechaEmision = formatDateEC(params.document.issuedAt ?? params.document.createdAt);
  const { tipo: tipoIdComprador, valor: idComprador } = resolveIdentificacion(
    params.document.customerIdentification,
    params.document.customerIdentificationType
  );
  const linesXml = params.lines.map((l, i) => buildLineXml(l, i)).join("\n");

  // Agrupar impuestos por tasa para totalConImpuestos
  const taxMap = new Map<number, { codigoPorcentaje: string; baseImponible: number; valor: number }>();
  for (const line of params.lines) {
    const rate = Number(line.taxRate);
    const cp = resolveIvaCodigoPorcentaje(rate);
    const base = Number(line.subtotal);
    const tax = Number(line.taxAmount);
    const existing = taxMap.get(rate);
    if (existing) {
      existing.baseImponible += base;
      existing.valor += tax;
    } else {
      taxMap.set(rate, { codigoPorcentaje: cp, baseImponible: base, valor: tax });
    }
  }
  const taxGroupsXml = Array.from(taxMap.values())
    .map(
      (g) => `      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${g.codigoPorcentaje}</codigoPorcentaje>
        <baseImponible>${dec(g.baseImponible)}</baseImponible>
        <valor>${dec(g.valor)}</valor>
      </totalImpuesto>`
    )
    .join("\n");

  // infoAdicional opcional (email, teléfono)
  const infoAdicionalItems: string[] = [];
  if (params.document.customerEmail) {
    infoAdicionalItems.push(
      `    <campoAdicional nombre="email">${xmlEscape(params.document.customerEmail)}</campoAdicional>`
    );
  }
  if (params.document.customerPhone) {
    infoAdicionalItems.push(
      `    <campoAdicional nombre="telefono">${xmlEscape(params.document.customerPhone)}</campoAdicional>`
    );
  }
  const infoAdicionalXml =
    infoAdicionalItems.length > 0
      ? `\n  <infoAdicional>\n${infoAdicionalItems.join("\n")}\n  </infoAdicional>`
      : "";

  // Generar clave de acceso si la validación pasó sin errores
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
        documentType: params.document.documentType,
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
      warnings.push("No se pudo generar la clave de acceso. Verifica la configuración SRI.");
    }
  }

  const dirMatriz = xmlEscape(params.profile.dirMatriz ?? params.establishment.address);
  const contribuyenteRimpeXml = params.profile.contribuyenteRimpe
    ? `\n    <contribuyenteRimpe>${xmlEscape(params.profile.contribuyenteRimpe)}</contribuyenteRimpe>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XML PRELIMINAR — NO FIRMADO — SIN VALIDEZ TRIBUTARIA -->
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xmlEscape(params.profile.legalName)}</razonSocial>
    <nombreComercial>${xmlEscape(params.profile.tradeName ?? params.profile.legalName)}</nombreComercial>
    <ruc>${xmlEscape(params.profile.ruc)}</ruc>
    <claveAcceso>${claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${xmlEscape(params.establishment.code)}</estab>
    <ptoEmi>${xmlEscape(params.issuePoint.code)}</ptoEmi>
    <secuencial>${pad(params.sequentialNumber, 9)}</secuencial>
    <dirMatriz>${dirMatriz}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${xmlEscape(params.establishment.address)}</dirEstablecimiento>
    <obligadoContabilidad>${params.profile.accountingRequired ? "SI" : "NO"}</obligadoContabilidad>${contribuyenteRimpeXml}
    <tipoIdentificacionComprador>${tipoIdComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${xmlEscape(params.document.customerName)}</razonSocialComprador>
    <identificacionComprador>${xmlEscape(idComprador)}</identificacionComprador>
    <totalSinImpuestos>${dec(params.document.subtotal)}</totalSinImpuestos>
    <totalDescuento>${dec(params.document.discountTotal)}</totalDescuento>
    <totalConImpuestos>
${taxGroupsXml}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${dec(params.document.grandTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>01</formaPago>
        <total>${dec(params.document.grandTotal)}</total>
        <plazo>0</plazo>
        <unidadTiempo>dias</unidadTiempo>
      </pago>
    </pagos>
  </infoFactura>
  <detalles>
${linesXml}
  </detalles>${infoAdicionalXml}
</factura>`;

  return {
    xml,
    displayNumber,
    warnings,
    missingFields,
    accessKey,
    numberingPersisted: Boolean(params.persistedAccessKey),
  };
}
