import "@/lib/security/server-only";

type RideAdditionalField = {
  name: string;
  value: string;
};

type RidePayment = {
  code: string;
  label: string;
  amount: string;
  term: string;
  timeUnit: string;
};

type RideDetailAdditional = {
  name: string;
  value: string;
};

type RideDetail = {
  code: string;
  auxiliaryCode: string;
  quantity: string;
  description: string;
  detailAdditional: RideDetailAdditional[];
  unitPrice: string;
  subsidio: string;
  precioSinSubsidio: string;
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
    address: string;
    phone: string;
    email: string;
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
    irbpnr: string;
    propina: string;
    iva: RideTaxSummary[];
    importeTotal: string;
    valorTotalSinSubsidio: string;
    ahorroPorSubsidio: string;
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

function findFirstTag(xml: string, tagName: string) {
  const matcher = new RegExp(
    `<([\\w.-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/([\\w.-]+:)?${tagName}>`,
    "i",
  );
  const match = xml.match(matcher);
  return match ? decodeXmlEntities(match[2] ?? "") : "";
}

function findAllBlocks(xml: string, tagName: string) {
  const matcher = new RegExp(
    `<([\\w.-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/([\\w.-]+:)?${tagName}>`,
    "gi",
  );
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

const KNOWN_CODIGO_PORCENTAJE_TARIFA: Record<string, number> = {
  "0": 0,
  "2": 12,
  "4": 15,
  "5": 5,
  "6": 0,
  "7": 0,
  "8": 0,
};

function resolveTarifa(
  codigoPorcentaje: string,
  explicitTarifa: string,
  detailTaxMap: Map<string, number>,
  codigo: string,
): number {
  const explicit = Number(explicitTarifa);
  if (explicitTarifa && !isNaN(explicit) && explicit > 0) return explicit;

  const detailKey = `${codigo}:${codigoPorcentaje}`;
  const fromDetail = detailTaxMap.get(detailKey);
  if (fromDetail !== undefined && fromDetail > 0) return fromDetail;

  const known = KNOWN_CODIGO_PORCENTAJE_TARIFA[codigoPorcentaje];
  if (known !== undefined && known > 0) return known;

  if (explicitTarifa && !isNaN(explicit)) return explicit;
  if (fromDetail !== undefined) return fromDetail;
  if (known !== undefined) return known;

  return 0;
}

function formatTarifaLabel(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2);
}

function getTaxBucketLabel(codigoPorcentaje: string, tarifa: number) {
  if (codigoPorcentaje === "6") return "SUBTOTAL NO OBJETO DE IVA";
  if (codigoPorcentaje === "7") return "SUBTOTAL EXENTO DE IVA";

  if (tarifa > 0) return `SUBTOTAL ${formatTarifaLabel(tarifa)}%`;

  return "SUBTOTAL 0%";
}

function parseAuthorizedEnvelope(xml: string) {
  const authorizationNumber = findFirstTag(xml, "numeroAutorizacion");
  const authorizationDate = findFirstTag(xml, "fechaAutorizacion");
  const documentXmlRaw = findFirstTag(xml, "comprobante");

  if (!documentXmlRaw) {
    throw new Error(
      "El XML autorizado no contiene el comprobante interno del SRI.",
    );
  }

  const documentXml = decodeXmlEntities(documentXmlRaw);
  return {
    authorizationNumber,
    authorizationDate,
    documentXml,
  };
}

export function parseAuthorizedSriInvoiceXml(
  xml: string,
): ParsedAuthorizedSriInvoice {
  const { authorizationNumber, authorizationDate, documentXml } =
    parseAuthorizedEnvelope(xml);

  const infoTributaria = findAllBlocks(documentXml, "infoTributaria")[0] ?? "";
  const infoFactura = findAllBlocks(documentXml, "infoFactura")[0] ?? "";

  if (!infoTributaria || !infoFactura) {
    throw new Error(
      "El XML autorizado no corresponde a una factura SRI válida.",
    );
  }

  const ambienteCode = findFirstTag(infoTributaria, "ambiente");
  const tipoEmisionCode = findFirstTag(infoTributaria, "tipoEmision");

  // ── Details ────────────────────────────────────────────────────────────────

  const detailBlocks = findAllBlocks(documentXml, "detalle");
  const details: RideDetail[] = detailBlocks.map((detailXml) => {
    // Parse detail additional fields from <detallesAdicionales>
    const detAdicionalMatches = Array.from(
      detailXml.matchAll(
        /<([\w.-]+:)?detAdicional\b([^>]*)>([\s\S]*?)<\/([\w.-]+:)?detAdicional>/gi,
      ),
    );
    const detailAdditional: RideDetailAdditional[] = detAdicionalMatches.map(
      (m) => {
        const attrs = m[2] ?? "";
        const name = attrs.match(/\bnombre="([^"]+)"/i)?.[1] ?? "";
        return {
          name: decodeXmlEntities(name),
          value: decodeXmlEntities(m[3] ?? ""),
        };
      },
    );

    const unitPrice = normalizeAmount(
      findFirstTag(detailXml, "precioUnitario"),
    );
    const subsidio = normalizeAmount(findFirstTag(detailXml, "subsidio"));
    // precioSinSubsidio = unitPrice when no subsidy
    const precioSinSubsidio = normalizeAmount(
      findFirstTag(detailXml, "precioSinSubsidio") || unitPrice,
    );

    return {
      code: findFirstTag(detailXml, "codigoPrincipal") || "N/A",
      auxiliaryCode: findFirstTag(detailXml, "codigoAuxiliar"),
      quantity: findFirstTag(detailXml, "cantidad") || "0",
      description: findFirstTag(detailXml, "descripcion") || "N/A",
      detailAdditional,
      unitPrice,
      subsidio,
      precioSinSubsidio,
      discount: normalizeAmount(findFirstTag(detailXml, "descuento")),
      subtotalExcludingTax: normalizeAmount(
        findFirstTag(detailXml, "precioTotalSinImpuesto"),
      ),
    };
  });

  // ── Additional fields ──────────────────────────────────────────────────────

  const additionalFieldBlocks = Array.from(
    documentXml.matchAll(
      /<([\w.-]+:)?campoAdicional\b([^>]*)>([\s\S]*?)<\/([\w.-]+:)?campoAdicional>/gi,
    ),
  );
  const additionalFields = additionalFieldBlocks.map((match) => {
    const attrs = match[2] ?? "";
    const name = attrs.match(/\bnombre="([^"]+)"/i)?.[1] ?? "Campo";
    return {
      name: decodeXmlEntities(name),
      value: decodeXmlEntities(match[3] ?? ""),
    };
  });

  // ── Payments ───────────────────────────────────────────────────────────────

  const paymentBlocks = findAllBlocks(documentXml, "pago");
  const payments: RidePayment[] = paymentBlocks
    .map((paymentXml) => {
      const code = findFirstTag(paymentXml, "formaPago");
      if (!code) return null;
      return {
        code,
        label: PAYMENT_METHOD_LABELS[code] ?? code,
        amount: normalizeAmount(findFirstTag(paymentXml, "total")),
        term: findFirstTag(paymentXml, "plazo") || "0",
        timeUnit: findFirstTag(paymentXml, "unidadTiempo") || "Días",
      };
    })
    .filter((p): p is RidePayment => p !== null);

  // ── Build detail-level tax map (codigo:codigoPorcentaje → tarifa) ─────────

  const detailTaxMap = new Map<string, number>();
  for (const detailXml of detailBlocks) {
    const impuestoBlocks = findAllBlocks(detailXml, "impuesto");
    for (const impXml of impuestoBlocks) {
      const impCodigo = findFirstTag(impXml, "codigo");
      const impCodigoPct = findFirstTag(impXml, "codigoPorcentaje");
      const impTarifa = findFirstTag(impXml, "tarifa");
      if (impCodigo && impCodigoPct && impTarifa) {
        const key = `${impCodigo}:${impCodigoPct}`;
        const rate = Number(impTarifa);
        if (!isNaN(rate)) detailTaxMap.set(key, rate);
      }
    }
  }

  // ── Tax totals ─────────────────────────────────────────────────────────────

  const taxBlocks = findAllBlocks(documentXml, "totalImpuesto");
  const subtotalTaxed: RideTaxSummary[] = [];
  const iva: RideTaxSummary[] = [];
  let subtotalZero = "0.00";
  let subtotalNoObjetoIva = "0.00";
  let subtotalExentoIva = "0.00";
  let ice = "0.00";
  let irbpnr = "0.00";

  for (const taxXml of taxBlocks) {
    const codigo = findFirstTag(taxXml, "codigo");
    const codigoPorcentaje = findFirstTag(taxXml, "codigoPorcentaje");
    const baseImponible = normalizeAmount(
      findFirstTag(taxXml, "baseImponible"),
    );
    const valor = normalizeAmount(findFirstTag(taxXml, "valor"));
    const explicitTarifa = findFirstTag(taxXml, "tarifa");

    if (codigo === "3") {
      ice = valor;
      continue;
    }

    if (codigo === "5") {
      irbpnr = valor;
      continue;
    }

    const tarifa = resolveTarifa(
      codigoPorcentaje,
      explicitTarifa,
      detailTaxMap,
      codigo,
    );

    const label = getTaxBucketLabel(codigoPorcentaje, tarifa);

    if (label === "SUBTOTAL 0%") subtotalZero = baseImponible;
    if (label === "SUBTOTAL NO OBJETO DE IVA")
      subtotalNoObjetoIva = baseImponible;
    if (label === "SUBTOTAL EXENTO DE IVA") subtotalExentoIva = baseImponible;
    if (
      label.startsWith("SUBTOTAL ") &&
      label !== "SUBTOTAL 0%" &&
      label !== "SUBTOTAL NO OBJETO DE IVA" &&
      label !== "SUBTOTAL EXENTO DE IVA"
    ) {
      subtotalTaxed.push({ label, baseAmount: baseImponible, value: valor });
    }

    if (codigo === "2") {
      if (tarifa > 0) {
        iva.push({
          label: `IVA ${formatTarifaLabel(tarifa)}%`,
          baseAmount: baseImponible,
          value: valor,
        });
      } else if (Number(valor) > 0) {
        iva.push({
          label: "IVA 0%",
          baseAmount: baseImponible,
          value: valor,
        });
      }
    }
  }

  // ── Subsidio ────────────────────────────────────────────────────────────────

  const importeTotalNum = Number(findFirstTag(infoFactura, "importeTotal") || "0");
  let subsidySavings = 0;
  for (let i = 0; i < details.length; i++) {
    const detail = details[i];
    const qty = Number(detail.quantity) || 0;
    const subsidy = qty * (Number(detail.subsidio) || 0);
    if (subsidy <= 0) continue;
    // Preserve the original discounted subtotal and add only this line's
    // subsidy difference. Never apply one rate to the entire invoice.
    const unsubsidizedBase = qty * Number(detail.precioSinSubsidio) - Number(detail.discount);
    const priceDifference = unsubsidizedBase - Number(detail.subtotalExcludingTax);
    const baseDifference = priceDifference > 0 ? priceDifference : subsidy;
    let taxDifference = 0;
    for (const taxXml of findAllBlocks(detailBlocks[i], "impuesto")) {
      if (findFirstTag(taxXml, "codigo") !== "2") continue;
      const rate = resolveTarifa(findFirstTag(taxXml, "codigoPorcentaje"), findFirstTag(taxXml, "tarifa"), detailTaxMap, "2");
      if (rate <= 0) continue;
      const base = Number(findFirstTag(taxXml, "baseImponible")) || 0;
      const originalTax = Number(findFirstTag(taxXml, "valor")) || 0;
      taxDifference += Number(((base + baseDifference) * rate / 100).toFixed(2)) - originalTax;
    }
    subsidySavings += baseDifference + taxDifference;
  }
  const ahorroPorSubsidio = Math.max(subsidySavings, 0).toFixed(2);
  const valorTotalSinSubsidio = subsidySavings > 0.005
    ? (importeTotalNum + Number(ahorroPorSubsidio)).toFixed(2)
    : "0.00";

  return {
    emitter: {
      legalName: findFirstTag(infoTributaria, "razonSocial") || "N/A",
      tradeName: findFirstTag(infoTributaria, "nombreComercial"),
      ruc: findFirstTag(infoTributaria, "ruc") || "N/A",
      dirMatriz: findFirstTag(infoTributaria, "dirMatriz"),
      dirEstablecimiento: findFirstTag(infoFactura, "dirEstablecimiento"),
      obligadoContabilidad: findFirstTag(infoFactura, "obligadoContabilidad"),
      contribuyenteRimpe: findFirstTag(infoTributaria, "contribuyenteRimpe"),
      agenteRetencion: findFirstTag(infoFactura, "agenteRetencion"),
    },
    authorization: {
      number: authorizationNumber || "N/A",
      date: authorizationDate || "N/A",
      environmentCode: ambienteCode,
      environmentLabel: ambienteCode === "2" ? "PRODUCCIÓN" : "PRUEBAS",
      emissionCode: tipoEmisionCode || "1",
      emissionLabel:
        tipoEmisionCode === "1" || !tipoEmisionCode
          ? "NORMAL"
          : tipoEmisionCode,
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
      name:
        findFirstTag(infoFactura, "razonSocialComprador") || "Consumidor final",
      identification:
        findFirstTag(infoFactura, "identificacionComprador") || "N/A",
      address:
        additionalFields.find(
          (field) => field.name.toUpperCase() === "DIRECCION CLIENTE",
        )?.value ?? "",
      phone:
        additionalFields.find(
          (field) => field.name.toUpperCase() === "TELEFONO CLIENTE",
        )?.value ?? "",
      email:
        additionalFields.find(
          (field) => field.name.toUpperCase() === "EMAIL CLIENTE",
        )?.value ?? "",
    },
    details,
    additionalFields,
    payments,
    totals: {
      subtotalTaxed,
      subtotalZero,
      subtotalNoObjetoIva,
      subtotalExentoIva,
      subtotalSinImpuestos: normalizeAmount(
        findFirstTag(infoFactura, "totalSinImpuestos"),
      ),
      totalDescuento: normalizeAmount(
        findFirstTag(infoFactura, "totalDescuento"),
      ),
      ice,
      irbpnr,
      propina: normalizeAmount(findFirstTag(infoFactura, "propina")),
      iva,
      importeTotal: normalizeAmount(findFirstTag(infoFactura, "importeTotal")),
      valorTotalSinSubsidio,
      ahorroPorSubsidio,
    },
  };
}
