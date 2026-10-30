import "@/lib/security/server-only";

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";

type ParsedSalesXml = {
  accessKey: string | null;
  rucEmitter: string | null;
  legalName: string | null;
  documentNumber: string | null;
  documentType: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE" | null;
  issueDate: string | null;
  customerIdentificationType: string | null;
  customerIdentification: string | null;
  customerName: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: Array<{
    productCode: string | null;
    productName: string | null;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
  }>;
};

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]!);
  }
  return results;
}

function mapCodDocToType(codDoc: string | null): ParsedSalesXml["documentType"] {
  if (codDoc === "01") return "INVOICE";
  if (codDoc === "04") return "CREDIT_NOTE";
  if (codDoc === "05") return "DEBIT_NOTE";
  return null;
}

function mapIdType(tipoId: string | null): string | null {
  if (tipoId === "04") return "CEDULA";
  if (tipoId === "05") return "RUC";
  if (tipoId === "06") return "PASAPORTE";
  if (tipoId === "07") return "CONSUMIDOR_FINAL";
  if (tipoId === "08") return "FOREIGN_ID";
  return tipoId;
}

export function parseSalesXml(xmlString: string): ParsedSalesXml {
  const infoTributaria = extractTag(xmlString, "infoTributaria") ?? "";

  const accessKey = extractTag(infoTributaria, "claveAcceso");
  const rucEmitter = extractTag(infoTributaria, "ruc");
  const legalName = extractTag(infoTributaria, "razonSocial");
  const estab = extractTag(infoTributaria, "estab") ?? "";
  const ptoEmi = extractTag(infoTributaria, "ptoEmi") ?? "";
  const secuencial = extractTag(infoTributaria, "secuencial") ?? "";
  const documentNumber = `${estab}-${ptoEmi}-${secuencial}`;
  const codDoc = extractTag(infoTributaria, "codDoc");
  const documentType = mapCodDocToType(codDoc);

  const infoFactura = extractTag(xmlString, "infoFactura")
    ?? extractTag(xmlString, "infoNotaCredito")
    ?? extractTag(xmlString, "infoNotaDebito")
    ?? "";

  const issueDate = extractTag(infoFactura, "fechaEmision");
  const tipoIdComprador = extractTag(infoFactura, "tipoIdentificacionComprador");
  const customerIdentification = extractTag(infoFactura, "identificacionComprador");
  const customerName = extractTag(infoFactura, "razonSocialComprador");
  const totalSinImpuestos = Number(extractTag(infoFactura, "totalSinImpuestos") ?? "0");
  const importeTotal = Number(extractTag(infoFactura, "importeTotal") ?? "0");

  const totalImpuestos = extractTag(infoFactura, "totalConImpuestos") ?? "";
  const taxBlocks = extractAllBlocks(totalImpuestos, "totalImpuesto");
  let taxTotal = 0;
  for (const block of taxBlocks) {
    const codigo = extractTag(block, "codigo") ?? "";
    if (codigo === "2" || codigo === "4") {
      taxTotal += Number(extractTag(block, "valor") ?? "0");
    }
  }

  const detalles = extractAllBlocks(xmlString, "detalle");
  const items: ParsedSalesXml["items"] = detalles.map((det) => {
    const productCode = extractTag(det, "codigoPrincipal");
    const productName = extractTag(det, "descripcion");
    const quantity = Number(extractTag(det, "cantidad") ?? "0");
    const unitPrice = Number(extractTag(det, "precioUnitario") ?? "0");
    const discountAmount = Number(extractTag(det, "descuento") ?? "0");
    const lineSubtotal = Number(extractTag(det, "precioTotalSinImpuesto") ?? "0");

    const itemTaxes = extractAllBlocks(det, "impuesto");
    let lineTaxAmount = 0;
    let lineTaxRate = 0;
    for (const imp of itemTaxes) {
      const codigo = extractTag(imp, "codigo") ?? "";
      if (codigo === "2") {
        lineTaxAmount += Number(extractTag(imp, "valor") ?? "0");
        const tarifa = Number(extractTag(imp, "tarifa") ?? "0");
        if (tarifa > lineTaxRate) lineTaxRate = tarifa;
      }
    }

    return {
      productCode,
      productName,
      quantity,
      unitPrice,
      discountAmount,
      subtotal: lineSubtotal,
      taxRate: lineTaxRate,
      taxAmount: lineTaxAmount,
      total: lineSubtotal + lineTaxAmount,
    };
  });

  return {
    accessKey,
    rucEmitter,
    legalName,
    documentNumber,
    documentType,
    issueDate,
    customerIdentificationType: mapIdType(tipoIdComprador),
    customerIdentification,
    customerName,
    subtotal: totalSinImpuestos,
    taxTotal,
    total: importeTotal,
    items,
  };
}

function parseEcDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00-05:00`);
  return isNaN(d.getTime()) ? null : d;
}

export type SalesXmlImportResult = {
  ok: boolean;
  externalDocumentId?: string;
  error: string;
};

export async function importSalesXml(
  tenantId: string,
  xmlContent: string,
  expectedIssuerRuc: string | null,
): Promise<SalesXmlImportResult> {
  const parsed = parseSalesXml(xmlContent);

  if (!parsed.accessKey) {
    return { ok: false, error: "XML no contiene clave de acceso." };
  }

  if (!parsed.documentType) {
    return { ok: false, error: "Tipo de comprobante no reconocido." };
  }

  if (expectedIssuerRuc && parsed.rucEmitter && parsed.rucEmitter !== expectedIssuerRuc) {
    return { ok: false, error: `RUC emisor (${parsed.rucEmitter}) no corresponde al tenant (${expectedIssuerRuc}).` };
  }

  const prisma = getPrismaClient();

  const existsByKey = await prisma.externalSalesDocument.findFirst({
    where: { tenantId, accessKey: parsed.accessKey },
    select: { id: true },
  });
  if (existsByKey) {
    return { ok: false, error: "Este comprobante ya está registrado.", externalDocumentId: existsByKey.id };
  }

  const existsByNumber = await prisma.externalSalesDocument.findFirst({
    where: { tenantId, documentType: parsed.documentType, documentNumber: parsed.documentNumber ?? "" },
    select: { id: true },
  });
  if (existsByNumber) {
    return { ok: false, error: "Este comprobante ya está registrado.", externalDocumentId: existsByNumber.id };
  }

  const sriDoc = await prisma.sriDocument.findFirst({
    where: { tenantId, accessKey: parsed.accessKey },
    select: { id: true },
  });
  if (sriDoc) {
    return { ok: false, error: "Este comprobante ya existe como documento nativo Facturom." };
  }

  const issueDate = parseEcDate(parsed.issueDate) ?? new Date();

  const itemsData: Prisma.ExternalSalesDocumentItemCreateWithoutDocumentInput[] = parsed.items.map((item) => ({
    productCode: item.productCode,
    productName: item.productName,
    quantity: new Prisma.Decimal(item.quantity),
    unitPrice: new Prisma.Decimal(item.unitPrice),
    discountAmount: new Prisma.Decimal(item.discountAmount),
    subtotal: new Prisma.Decimal(Number(item.subtotal.toFixed(2))),
    taxRate: new Prisma.Decimal(item.taxRate),
    taxAmount: new Prisma.Decimal(Number(item.taxAmount.toFixed(2))),
    total: new Prisma.Decimal(Number(item.total.toFixed(2))),
  }));

  const doc = await prisma.externalSalesDocument.create({
    data: {
      tenantId,
      source: "SRI_FACTURADOR",
      documentType: parsed.documentType,
      documentNumber: parsed.documentNumber ?? "",
      accessKey: parsed.accessKey,
      issueDate,
      customerIdentificationType: parsed.customerIdentificationType,
      customerIdentification: parsed.customerIdentification,
      customerName: parsed.customerName ?? "Desconocido",
      subtotal: new Prisma.Decimal(Number(parsed.subtotal.toFixed(2))),
      taxTotal: new Prisma.Decimal(Number(parsed.taxTotal.toFixed(2))),
      total: new Prisma.Decimal(Number(parsed.total.toFixed(2))),
      status: "IMPORTED",
      rawPayload: { xml: xmlContent.slice(0, 50000) },
      items: itemsData.length > 0 ? { create: itemsData } : undefined,
    },
    select: { id: true },
  });

  return { ok: true, externalDocumentId: doc.id, error: "" };
}
