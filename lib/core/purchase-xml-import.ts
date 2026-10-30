import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { createPurchaseDocument } from "./purchase-documents";

export type ParsedPurchaseXml = {
  accessKey: string | null;
  authorizationNumber: string | null;
  rucEmitter: string | null;
  legalName: string | null;
  tradeName: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  buyerIdentification: string | null;
  documentType: string | null;
  items: Array<{
    xmlProductCode: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
  }>;
  subtotal0: number;
  subtotal5: number;
  subtotal15: number;
  subtotalNoTax: number;
  subtotalExempt: number;
  ivaTotal: number;
  iceTotal: number;
  discountTotal: number;
  tipAmount: number;
  total: number;
  sriPaymentCode: string | null;
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

export function parsePurchaseXml(xmlString: string): ParsedPurchaseXml {
  const infoTributaria = extractTag(xmlString, "infoTributaria") ?? "";

  const accessKey = extractTag(infoTributaria, "claveAcceso");
  const rucEmitter = extractTag(infoTributaria, "ruc");
  const legalName = extractTag(infoTributaria, "razonSocial");
  const tradeName = extractTag(infoTributaria, "nombreComercial");
  const estab = extractTag(infoTributaria, "estab") ?? "";
  const ptoEmi = extractTag(infoTributaria, "ptoEmi") ?? "";
  const secuencial = extractTag(infoTributaria, "secuencial") ?? "";
  const documentNumber = `${estab}-${ptoEmi}-${secuencial}`;
  const codDoc = extractTag(infoTributaria, "codDoc");

  let documentType: string | null = null;
  if (codDoc === "01") documentType = "INVOICE";
  else if (codDoc === "04") documentType = "CREDIT_NOTE";
  else if (codDoc === "05") documentType = "DEBIT_NOTE";
  else if (codDoc === "03") documentType = "PURCHASE_SETTLEMENT";

  const infoFactura = extractTag(xmlString, "infoFactura")
    ?? extractTag(xmlString, "infoLiquidacionCompra")
    ?? extractTag(xmlString, "infoNotaCredito")
    ?? extractTag(xmlString, "infoNotaDebito")
    ?? "";
  const issueDate = extractTag(infoFactura, "fechaEmision");
  const buyerIdentification = extractTag(infoFactura, "identificacionComprador");
  const totalSinImpuestos = Number(extractTag(infoFactura, "totalSinImpuestos") ?? "0");
  const totalDescuento = Number(extractTag(infoFactura, "totalDescuento") ?? "0");
  const importeTotal = Number(extractTag(infoFactura, "importeTotal") ?? "0");
  const propina = Number(extractTag(infoFactura, "propina") ?? "0");

  const totalImpuestos = extractTag(infoFactura, "totalConImpuestos") ?? "";
  const taxBlocks = extractAllBlocks(totalImpuestos, "totalImpuesto");
  let subtotal0 = 0;
  let subtotal5 = 0;
  let subtotal15 = 0;
  let subtotalNoTax = 0;
  let subtotalExempt = 0;
  let ivaTotal = 0;
  let iceTotal = 0;

  for (const block of taxBlocks) {
    const codigo = extractTag(block, "codigo") ?? "";
    const codigoPct = extractTag(block, "codigoPorcentaje") ?? "";
    const base = Number(extractTag(block, "baseImponible") ?? "0");
    const valor = Number(extractTag(block, "valor") ?? "0");

    if (codigo === "3") {
      iceTotal += valor;
      continue;
    }

    if (codigoPct === "0") subtotal0 += base;
    else if (codigoPct === "5") { subtotal5 += base; ivaTotal += valor; }
    else if (codigoPct === "2" || codigoPct === "4") { subtotal15 += base; ivaTotal += valor; }
    else if (codigoPct === "6") subtotalNoTax += base;
    else if (codigoPct === "7") subtotalExempt += base;
    else { subtotal15 += base; ivaTotal += valor; }
  }

  if (subtotal0 === 0 && subtotal15 === 0 && subtotal5 === 0 && totalSinImpuestos > 0) {
    subtotal0 = totalSinImpuestos;
  }

  const detalles = extractAllBlocks(xmlString, "detalle");
  const items = detalles.map((d) => {
    const xmlProductCode = extractTag(d, "codigoPrincipal");
    const desc = extractTag(d, "descripcion") ?? "";
    const qty = Number(extractTag(d, "cantidad") ?? "0");
    const price = Number(extractTag(d, "precioUnitario") ?? "0");
    const disc = Number(extractTag(d, "descuento") ?? "0");
    const sub = Number(extractTag(d, "precioTotalSinImpuesto") ?? "0");
    const impuesto = extractTag(d, "impuestos") ?? "";
    const taxBlock = extractTag(impuesto, "impuesto") ?? "";
    const tarifa = Number(extractTag(taxBlock, "tarifa") ?? "0");
    const taxAmt = Number(extractTag(taxBlock, "valor") ?? "0");
    return {
      xmlProductCode,
      description: desc,
      quantity: qty,
      unitPrice: price,
      discountAmount: disc,
      subtotal: sub,
      taxRate: tarifa,
      taxAmount: taxAmt,
      total: sub + taxAmt,
    };
  });

  const pagos = extractTag(xmlString, "pagos") ?? "";
  const pagoBlock = extractTag(pagos, "pago") ?? "";
  const sriPaymentCode = extractTag(pagoBlock, "formaPago");

  return {
    accessKey,
    authorizationNumber: accessKey,
    rucEmitter,
    legalName,
    tradeName,
    documentNumber,
    issueDate,
    buyerIdentification,
    documentType,
    items,
    subtotal0,
    subtotal5,
    subtotal15,
    subtotalNoTax,
    subtotalExempt,
    ivaTotal,
    iceTotal,
    discountTotal: totalDescuento,
    tipAmount: propina,
    total: importeTotal,
    sriPaymentCode,
  };
}

export type ImportXmlResult =
  | { ok: true; purchaseDocumentId: string; inboxItemId: string }
  | { ok: false; error: string };

export async function importPurchaseXml(
  tenantId: string,
  createdByUserId: string,
  xmlString: string,
  tenantRuc?: string | null,
): Promise<ImportXmlResult> {
  const parsed = parsePurchaseXml(xmlString);

  if (parsed.buyerIdentification && tenantRuc) {
    if (parsed.buyerIdentification !== tenantRuc) {
      return {
        ok: false,
        error: `El RUC del receptor (${parsed.buyerIdentification}) no corresponde al tenant (${tenantRuc}).`,
      };
    }
  }

  const prisma = getPrismaClient();

  if (parsed.accessKey) {
    const existing = await prisma.purchaseDocument.findFirst({
      where: { tenantId, accessKey: parsed.accessKey },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "Este documento ya está registrado." };
    }
  }

  let supplierId: string | null = null;
  if (parsed.rucEmitter) {
    const supplier = await prisma.lightweightSupplier.findFirst({
      where: { tenantId, identification: parsed.rucEmitter },
      select: { id: true },
    });
    supplierId = supplier?.id ?? null;
  }

  let parsedDate: Date | null = null;
  if (parsed.issueDate) {
    const parts = parsed.issueDate.split("/");
    if (parts.length === 3) {
      parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00-05:00`);
    }
  }

  const purchaseDoc = await createPurchaseDocument({
    tenantId,
    createdByUserId,
    supplierId,
    documentType: (parsed.documentType as "INVOICE") ?? "INVOICE",
    supplierDocumentNumber: parsed.documentNumber,
    accessKey: parsed.accessKey,
    authorizationNumber: parsed.authorizationNumber,
    issueDate: parsedDate,
    subtotal0: parsed.subtotal0,
    subtotal15: parsed.subtotal15,
    subtotalNoTax: parsed.subtotalNoTax,
    subtotalExempt: parsed.subtotalExempt,
    iceTotal: parsed.iceTotal,
    ivaTotal: parsed.ivaTotal,
    discountTotal: parsed.discountTotal,
    tipAmount: parsed.tipAmount,
    total: parsed.total,
    sriPaymentCode: parsed.sriPaymentCode,
    status: parsed.accessKey ? "AUTHORIZED" : "REGISTERED",
    origin: "XML_IMPORT",
    supplierName: parsed.legalName,
    supplierIdentification: parsed.rucEmitter,
    items: parsed.items.map((item) => ({
      xmlProductCode: item.xmlProductCode,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      taxRate: item.taxRate,
    })),
  });

  const inboxItem = await prisma.purchaseInboxItem.create({
    data: {
      tenantId,
      purchaseDocumentId: purchaseDoc.id,
      accessKey: parsed.accessKey,
      supplierName: parsed.legalName,
      supplierRuc: parsed.rucEmitter,
      documentNumber: parsed.documentNumber,
      documentType: parsed.documentType,
      issueDate: parsedDate,
      subtotal: parsed.subtotal0 + parsed.subtotal15,
      ivaTotal: parsed.ivaTotal,
      total: parsed.total,
      status: "REGISTERED",
      origin: "XML_IMPORT",
      processedAt: new Date(),
    },
  });

  return { ok: true, purchaseDocumentId: purchaseDoc.id, inboxItemId: inboxItem.id };
}
