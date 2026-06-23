import "@/lib/security/server-only";

type RideAdditionalField = {
  name: string;
  value: string;
};

type RidePayment = {
  code: string;
  label: string;
};

type RideDetail = {
  code: string;
  quantity: string;
  description: string;
  unitPrice: string;
  discount: string;
  subtotalExcludingTax: string;
};

type RideTaxSummary = {
  label: string;
  baseAmount: string;
  value: string;
};

export type ParsedAuthorizedSriInvoice = {
  emitter: {
    legalName: string;
    tradeName: string;
    ruc: string;
    dirMatriz: string;
    dirEstablecimiento: string;
    obligadoContabilidad: string;
    contribuyenteRimpe: string;
    agenteRetencion: string;
  };
  authorization: {
    number: string;
    date: string;
    environmentCode: string;
    environmentLabel: string;
    emissionCode: string;
    emissionLabel: string;
    accessKey: string;
  };
  document: {
    typeLabel: string;
    number: string;
    issueDate: string;
    guideRemission: string;
  };
  customer: {
    name: string;
    identification: string;
  };
  details: RideDetail[];
  additionalFields: RideAdditionalField[];
  payments: RidePayment[];
  totals: {
    subtotalTaxed: RideTaxSummary[];
    subtotalZero: string;
    subtotalNoObjetoIva: string;
    subtotalExentoIva: string;
    subtotalSinImpuestos: string;
    totalDescuento: string;
    ice: string;
    iva: RideTaxSummary[];
    importeTotal: string;
  };
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  "01": "Sin utilización del sistema financiero",
  "15": "Compensación de deudas",
  "16": "Tarjeta de débito",
  "17": "Dinero electrónico",
  "18": "Tarjeta prepago",
  "19": "Tarjeta de crédito",
  "20": "Otros con utilización del sistema financiero",
  "21": "Endoso de títulos",
};

function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function stripNamespace(tag: string) {
  return tag.replace(/^[^:]+:/, "");
}

function findFirstTag(xml: string, tagName: string) {
  const matcher = new RegExp(`<([\\w.-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/([\\w.-]+:)?${tagName}>`, "i");
  const match = xml.match(matcher);
  return match ? decodeXmlEntities(match[2] ?? "") : "";
}

function findAllBlocks(xml: string, tagName: string) {
  const matcher = new RegExp(`<([\\w.-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/([\\w.-]+:)?${tagName}>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(xml)) !== null) {
    blocks.push(match[2] ?? "");
  }

  return blocks;
}

function normalizeAmount(value: string) {
  return value.trim() || "0.00";
}

function getTaxBucketLabel(codigoPorcentaje: string, tarifa: string) {
  if (codigoPorcentaje === "6") return "SUBTOTAL NO OBJETO DE IVA";
  if (codigoPorcentaje === "7") return "SUBTOTAL EXENTO DE IVA";

  const numericRate = Number(tarifa || "0");
  if (numericRate > 0) return `SUBTOTAL ${Number.isInteger(numericRate) ? numericRate : tarifa}%`;

  return "SUBTOTAL 0%";
}

function parseAuthorizedEnvelope(xml: string) {
  const authorizationNumber = findFirstTag(xml, "numeroAutorizacion");
  const authorizationDate = findFirstTag(xml, "fechaAutorizacion");
  const documentXmlRaw = findFirstTag(xml, "comprobante");

  if (!documentXmlRaw) {
    throw new Error("El XML autorizado no contiene el comprobante interno del SRI.");
  }

  const documentXml = decodeXmlEntities(documentXmlRaw);
  return {
    authorizationNumber,
    authorizationDate,
    documentXml,
  };
}

export function parseAuthorizedSriInvoiceXml(xml: string): ParsedAuthorizedSriInvoice {
  const { authorizationNumber, authorizationDate, documentXml } = parseAuthorizedEnvelope(xml);

  const infoTributaria = findAllBlocks(documentXml, "infoTributaria")[0] ?? "";
  const infoFactura = findAllBlocks(documentXml, "infoFactura")[0] ?? "";

  if (!infoTributaria || !infoFactura) {
    throw new Error("El XML autorizado no corresponde a una factura SRI válida.");
  }

  const ambienteCode = findFirstTag(infoTributaria, "ambiente");
  const tipoEmisionCode = findFirstTag(infoTributaria, "tipoEmision");

  const detailBlocks = findAllBlocks(documentXml, "detalle");
  const details = detailBlocks.map((detailXml) => ({
    code: findFirstTag(detailXml, "codigoPrincipal") || "N/A",
    quantity: findFirstTag(detailXml, "cantidad") || "0",
    description: findFirstTag(detailXml, "descripcion") || "N/A",
    unitPrice: normalizeAmount(findFirstTag(detailXml, "precioUnitario")),
    discount: normalizeAmount(findFirstTag(detailXml, "descuento")),
    subtotalExcludingTax: normalizeAmount(findFirstTag(detailXml, "precioTotalSinImpuesto")),
  }));

  const additionalFieldBlocks = Array.from(
    documentXml.matchAll(/<([\w.-]+:)?campoAdicional\b([^>]*)>([\s\S]*?)<\/([\w.-]+:)?campoAdicional>/gi)
  );
  const additionalFields = additionalFieldBlocks.map((match) => {
    const attrs = match[2] ?? "";
    const name = attrs.match(/\bnombre="([^"]+)"/i)?.[1] ?? "Campo";
    return {
      name: decodeXmlEntities(name),
      value: decodeXmlEntities(match[3] ?? ""),
    };
  });

  const paymentBlocks = findAllBlocks(documentXml, "pago");
  const payments = paymentBlocks
    .map((paymentXml) => findFirstTag(paymentXml, "formaPago"))
    .filter(Boolean)
    .map((code) => ({
      code,
      label: PAYMENT_METHOD_LABELS[code] ?? code,
    }));

  const taxBlocks = findAllBlocks(documentXml, "totalImpuesto");
  const subtotalTaxed: RideTaxSummary[] = [];
  const iva: RideTaxSummary[] = [];
  let subtotalZero = "0.00";
  let subtotalNoObjetoIva = "0.00";
  let subtotalExentoIva = "0.00";
  let ice = "0.00";

  for (const taxXml of taxBlocks) {
    const codigo = findFirstTag(taxXml, "codigo");
    const codigoPorcentaje = findFirstTag(taxXml, "codigoPorcentaje");
    const baseImponible = normalizeAmount(findFirstTag(taxXml, "baseImponible"));
    const valor = normalizeAmount(findFirstTag(taxXml, "valor"));
    const tarifa = normalizeAmount(findFirstTag(taxXml, "tarifa"));

    if (codigo === "3") {
      ice = valor;
      continue;
    }

    const label = getTaxBucketLabel(codigoPorcentaje, tarifa);

    if (label === "SUBTOTAL 0%") subtotalZero = baseImponible;
    if (label === "SUBTOTAL NO OBJETO DE IVA") subtotalNoObjetoIva = baseImponible;
    if (label === "SUBTOTAL EXENTO DE IVA") subtotalExentoIva = baseImponible;
    if (label.startsWith("SUBTOTAL ") && label !== "SUBTOTAL 0%" && label !== "SUBTOTAL NO OBJETO DE IVA" && label !== "SUBTOTAL EXENTO DE IVA") {
      subtotalTaxed.push({ label, baseAmount: baseImponible, value: valor });
    }

    if (codigo === "2") {
      iva.push({
        label: Number(tarifa) > 0 ? `IVA ${Number.isInteger(Number(tarifa)) ? Number(tarifa) : tarifa}%` : "IVA 0%",
        baseAmount: baseImponible,
        value: valor,
      });
    }
  }

  return {
    emitter: {
      legalName: findFirstTag(infoTributaria, "razonSocial") || "N/A",
      tradeName: findFirstTag(infoTributaria, "nombreComercial"),
      ruc: findFirstTag(infoTributaria, "ruc") || "N/A",
      dirMatriz: findFirstTag(infoTributaria, "dirMatriz"),
      dirEstablecimiento: findFirstTag(infoFactura, "dirEstablecimiento"),
      obligadoContabilidad: findFirstTag(infoFactura, "obligadoContabilidad"),
      contribuyenteRimpe: findFirstTag(infoFactura, "contribuyenteRimpe"),
      agenteRetencion: findFirstTag(infoFactura, "agenteRetencion"),
    },
    authorization: {
      number: authorizationNumber || "N/A",
      date: authorizationDate || "N/A",
      environmentCode: ambienteCode,
      environmentLabel: ambienteCode === "2" ? "PRODUCCIÓN" : "PRUEBAS",
      emissionCode: tipoEmisionCode || "1",
      emissionLabel: tipoEmisionCode === "1" || !tipoEmisionCode ? "NORMAL" : tipoEmisionCode,
      accessKey:
        findFirstTag(infoTributaria, "claveAcceso") ||
        authorizationNumber ||
        "N/A",
    },
    document: {
      typeLabel: "FACTURA",
      number: [
        findFirstTag(infoTributaria, "estab"),
        findFirstTag(infoTributaria, "ptoEmi"),
        findFirstTag(infoTributaria, "secuencial"),
      ]
        .filter(Boolean)
        .join("-"),
      issueDate: findFirstTag(infoFactura, "fechaEmision") || "N/A",
      guideRemission: findFirstTag(infoFactura, "guiaRemision"),
    },
    customer: {
      name: findFirstTag(infoFactura, "razonSocialComprador") || "Consumidor final",
      identification: findFirstTag(infoFactura, "identificacionComprador") || "N/A",
    },
    details,
    additionalFields,
    payments,
    totals: {
      subtotalTaxed,
      subtotalZero,
      subtotalNoObjetoIva,
      subtotalExentoIva,
      subtotalSinImpuestos: normalizeAmount(findFirstTag(infoFactura, "totalSinImpuestos")),
      totalDescuento: normalizeAmount(findFirstTag(infoFactura, "totalDescuento")),
      ice,
      iva,
      importeTotal: normalizeAmount(findFirstTag(infoFactura, "importeTotal")),
    },
  };
}
