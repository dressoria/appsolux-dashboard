import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { createPurchaseDocument } from "./purchase-documents";

export type ParsedPurchaseXml = {
  accessKey: string | null;
  authorizationNumber: string | null;
  rucEmitter: string | null;
  legalName: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  buyerIdentification: string | null;
  documentType: string | null;
  items: Array<{
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
  subtotal15: number;
  ivaTotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: string | null;
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

  const infoFactura = extractTag(xmlString, "infoFactura") ?? "";
  const issueDate = extractTag(infoFactura, "fechaEmision");
  const buyerIdentification = extractTag(infoFactura, "identificacionComprador");
  const totalSinImpuestos = Number(extractTag(infoFactura, "totalSinImpuestos") ?? "0");
  const totalDescuento = Number(extractTag(infoFactura, "totalDescuento") ?? "0");
  const importeTotal = Number(extractTag(infoFactura, "importeTotal") ?? "0");

  const totalImpuestos = extractTag(infoFactura, "totalConImpuestos") ?? "";
  const taxBlocks = extractAllBlocks(totalImpuestos, "totalImpuesto");
  let subtotal0 = 0;
  let subtotal15 = 0;
  let ivaTotal = 0;
  for (const block of taxBlocks) {
    const codigoPct = extractTag(block, "codigoPorcentaje") ?? "";
    const base = Number(extractTag(block, "baseImponible") ?? "0");
    const valor = Number(extractTag(block, "valor") ?? "0");
    if (codigoPct === "0") {
      subtotal0 += base;
    } else {
      subtotal15 += base;
      ivaTotal += valor;
    }
  }

  const detalles = extractAllBlocks(xmlString, "detalle");
  const items = detalles.map((d) => {
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
  const formaPago = extractTag(pagoBlock, "formaPago");

  return {
    accessKey,
    authorizationNumber: accessKey,
    rucEmitter,
    legalName,
    documentNumber,
    issueDate,
    buyerIdentification,
    documentType,
    items,
    subtotal0: subtotal0 || totalSinImpuestos - subtotal15,
    subtotal15,
    ivaTotal,
    discountTotal: totalDescuento,
    total: importeTotal,
    paymentMethod: formaPago,
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
    ivaTotal: parsed.ivaTotal,
    discountTotal: parsed.discountTotal,
    total: parsed.total,
    paymentMethod: parsed.paymentMethod,
    status: parsed.accessKey ? "AUTHORIZED" : "REGISTERED",
    origin: "XML_IMPORT",
    supplierName: parsed.legalName,
    supplierIdentification: parsed.rucEmitter,
    items: parsed.items.map((item) => ({
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
