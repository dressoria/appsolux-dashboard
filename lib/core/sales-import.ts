import "@/lib/security/server-only";

import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";

// ── Types ────────────────────────────────────────────────────────────────────

export const SALES_IMPORT_COLUMNS = [
  "numero_externo",
  "fecha",
  "identificacion_cliente",
  "nombre_cliente",
  "codigo_producto",
  "descripcion",
  "cantidad",
  "precio_unitario",
  "descuento",
  "iva",
  "forma_pago",
  "total",
] as const;

export type SalesImportRawRow = Record<
  (typeof SALES_IMPORT_COLUMNS)[number],
  string
>;

export type SalesImportRowResult = {
  row: number;
  externalRef: string;
  customerName: string;
  productCode: string;
  date: string;
  total: string;
  status: "VALID" | "WARNING" | "ERROR";
  messages: string[];
};

export type SalesImportPreview = {
  rows: SalesImportRowResult[];
  salesDetected: number;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  totalAmount: number;
  hasBlockingErrors: boolean;
};

type ParsedSaleLine = {
  externalRef: string;
  date: Date;
  customerIdentification: string;
  customerName: string;
  productCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  ivaRate: number;
  paymentMethod: string;
};

type GroupedSale = {
  externalRef: string;
  date: Date;
  customerIdentification: string;
  customerName: string;
  paymentMethod: string;
  lines: ParsedSaleLine[];
};

// ── CSV/XLSX Parsing ─────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const output: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      output.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  output.push(value);
  return output;
}

export async function readSalesImportFile(
  buffer: Buffer,
  fileName: string,
): Promise<SalesImportRawRow[]> {
  let records: string[][];

  if (fileName.toLowerCase().endsWith(".csv")) {
    records = buffer
      .toString("utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseCsvLine);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets[0];
    records = [];
    sheet?.eachRow((row) =>
      records.push(
        (row.values as unknown[])
          .slice(1)
          .map((v) => String(v ?? "")),
      ),
    );
  }

  const headers =
    records.shift()?.map((h) => h.trim().toLowerCase()) ?? [];

  return records.map((values) =>
    Object.fromEntries(
      SALES_IMPORT_COLUMNS.map((col) => [
        col,
        values[headers.indexOf(col)]?.trim() ?? "",
      ]),
    ) as SalesImportRawRow,
  );
}

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_PAYMENT_METHODS = new Set([
  "cash",
  "transfer",
  "card",
  "credit",
  "efectivo",
  "transferencia",
  "tarjeta",
  "credito",
]);

const PAYMENT_NORMALIZE: Record<string, string> = {
  efectivo: "cash",
  transferencia: "transfer",
  tarjeta: "card",
  credito: "credit",
  cash: "cash",
  transfer: "transfer",
  card: "card",
  credit: "credit",
};

function parseDate(value: string): Date | null {
  const patterns = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;

    if (pattern === patterns[2]) {
      const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00-05:00`);
      if (!isNaN(d.getTime())) return d;
    } else {
      const d = new Date(
        `${match[3]}-${match[2]}-${match[1]}T00:00:00-05:00`,
      );
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export async function buildSalesImportPreview(
  tenantId: string,
  rows: SalesImportRawRow[],
): Promise<SalesImportPreview> {
  const prisma = getPrismaClient();

  const productCodes = [
    ...new Set(rows.map((r) => r.codigo_producto).filter(Boolean)),
  ];
  const products = await prisma.lightweightProduct.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { primaryCode: { in: productCodes } },
        { auxiliaryCode: { in: productCodes } },
      ],
    },
    select: { id: true, primaryCode: true, auxiliaryCode: true },
  });
  const productCodeSet = new Set<string>();
  for (const p of products) {
    if (p.primaryCode) productCodeSet.add(p.primaryCode);
    if (p.auxiliaryCode) productCodeSet.add(p.auxiliaryCode);
  }

  const existingRefs = await prisma.lightweightSale
    .findMany({
      where: {
        tenantId,
        origin: "IMPORT",
        externalReference: { not: null },
      },
      select: { externalReference: true },
    })
    .then((sales) =>
      new Set(
        sales
          .map((s) => s.externalReference)
          .filter((r): r is string => r !== null),
      ),
    );

  const results: SalesImportRowResult[] = [];
  const saleRefs = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    const messages: string[] = [];
    let status: "VALID" | "WARNING" | "ERROR" = "VALID";

    if (!row.numero_externo) {
      messages.push("numero_externo es obligatorio.");
      status = "ERROR";
    } else {
      saleRefs.add(row.numero_externo);
      if (existingRefs.has(row.numero_externo)) {
        messages.push("Ya importada — no se duplicará.");
        status = "WARNING";
      }
    }

    const date = parseDate(row.fecha);
    if (!row.fecha) {
      messages.push("Fecha es obligatoria.");
      status = "ERROR";
    } else if (!date) {
      messages.push("Formato de fecha inválido.");
      status = "ERROR";
    } else if (date > new Date()) {
      messages.push("Fecha futura no permitida.");
      status = "ERROR";
    }

    const qty = Number(row.cantidad);
    if (!row.cantidad || isNaN(qty) || qty <= 0) {
      messages.push("Cantidad debe ser mayor a 0.");
      status = "ERROR";
    }

    const price = Number(row.precio_unitario);
    if (row.precio_unitario === "" || isNaN(price) || price < 0) {
      messages.push("Precio unitario inválido.");
      status = "ERROR";
    }

    const ivaStr = row.iva?.trim();
    if (ivaStr && !["0", "15", "0%", "15%"].includes(ivaStr)) {
      messages.push("IVA debe ser 0 o 15.");
      status = "ERROR";
    }

    if (row.codigo_producto && !productCodeSet.has(row.codigo_producto)) {
      messages.push(
        `Producto "${row.codigo_producto}" no encontrado en este tenant.`,
      );
      status = "ERROR";
    }

    const pm = row.forma_pago?.toLowerCase().trim();
    if (pm && !VALID_PAYMENT_METHODS.has(pm)) {
      messages.push("Forma de pago inválida.");
      status = "ERROR";
    }

    if (messages.length === 0) {
      messages.push("OK");
    }

    const lineTotal = Number(row.total) || qty * price;

    results.push({
      row: rowNum,
      externalRef: row.numero_externo,
      customerName: row.nombre_cliente || "Consumidor final",
      productCode: row.codigo_producto,
      date: row.fecha,
      total: lineTotal.toFixed(2),
      status,
      messages,
    });
  }

  const validRows = results.filter((r) => r.status === "VALID").length;
  const warningRows = results.filter((r) => r.status === "WARNING").length;
  const errorRows = results.filter((r) => r.status === "ERROR").length;
  const totalAmount = results
    .filter((r) => r.status !== "ERROR")
    .reduce((sum, r) => sum + Number(r.total), 0);

  return {
    rows: results,
    salesDetected: saleRefs.size,
    totalRows: rows.length,
    validRows,
    warningRows,
    errorRows,
    totalAmount,
    hasBlockingErrors: errorRows > 0,
  };
}

// ── Import Execution ─────────────────────────────────────────────────────────

export async function confirmSalesImport(
  tenantId: string,
  userId: string,
  batchId: string,
  rows: SalesImportRawRow[],
): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
  totalAmount: number;
}> {
  const prisma = getPrismaClient();

  const productCodes = [
    ...new Set(rows.map((r) => r.codigo_producto).filter(Boolean)),
  ];
  const products = await prisma.lightweightProduct.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { primaryCode: { in: productCodes } },
        { auxiliaryCode: { in: productCodes } },
      ],
    },
    select: {
      id: true,
      primaryCode: true,
      auxiliaryCode: true,
      price: true,
      taxRate: true,
    },
  });
  const productByCode = new Map<
    string,
    { id: string; price: Prisma.Decimal; taxRate: Prisma.Decimal }
  >();
  for (const p of products) {
    if (p.primaryCode) productByCode.set(p.primaryCode, p);
    if (p.auxiliaryCode) productByCode.set(p.auxiliaryCode, p);
  }

  const existingRefs = await prisma.lightweightSale
    .findMany({
      where: {
        tenantId,
        origin: "IMPORT",
        externalReference: { not: null },
      },
      select: { externalReference: true },
    })
    .then((sales) =>
      new Set(
        sales
          .map((s) => s.externalReference)
          .filter((r): r is string => r !== null),
      ),
    );

  const grouped = new Map<string, GroupedSale>();
  for (const row of rows) {
    if (!row.numero_externo) continue;

    const date = parseDate(row.fecha);
    if (!date) continue;

    const qty = Number(row.cantidad);
    if (isNaN(qty) || qty <= 0) continue;

    const price = Number(row.precio_unitario);
    if (isNaN(price) || price < 0) continue;

    const ivaStr = row.iva?.trim().replace("%", "");
    const ivaRate = ivaStr === "15" ? 15 : 0;

    const pm = PAYMENT_NORMALIZE[row.forma_pago?.toLowerCase().trim() ?? ""] ?? "cash";

    const line: ParsedSaleLine = {
      externalRef: row.numero_externo,
      date,
      customerIdentification: row.identificacion_cliente?.trim() ?? "",
      customerName: row.nombre_cliente?.trim() || "Consumidor final",
      productCode: row.codigo_producto,
      description: row.descripcion || "",
      quantity: qty,
      unitPrice: price,
      discount: Number(row.descuento) || 0,
      ivaRate,
      paymentMethod: pm,
    };

    let sale = grouped.get(row.numero_externo);
    if (!sale) {
      sale = {
        externalRef: row.numero_externo,
        date,
        customerIdentification: line.customerIdentification,
        customerName: line.customerName,
        paymentMethod: pm,
        lines: [],
      };
      grouped.set(row.numero_externo, sale);
    }
    sale.lines.push(line);
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  let totalAmount = 0;

  for (const [extRef, sale] of grouped) {
    if (existingRefs.has(extRef)) {
      skipped++;
      continue;
    }

    let customerId: string | null = null;
    if (sale.customerIdentification) {
      const customer = await prisma.lightweightCustomer.findFirst({
        where: {
          tenantId,
          identification: sale.customerIdentification,
        },
        select: { id: true },
      });
      if (!customer) {
        errors.push(
          `Venta ${extRef}: cliente "${sale.customerIdentification}" no encontrado.`,
        );
        continue;
      }
      customerId = customer.id;
    }

    let subtotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    const itemsData: Array<{
      productId: string;
      quantity: number;
      price: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      total: Prisma.Decimal;
      description: string | null;
    }> = [];

    let hasProductError = false;
    for (const line of sale.lines) {
      const product = line.productCode
        ? productByCode.get(line.productCode)
        : null;
      if (line.productCode && !product) {
        errors.push(
          `Venta ${extRef}: producto "${line.productCode}" no encontrado.`,
        );
        hasProductError = true;
        break;
      }

      const unitPrice = new Prisma.Decimal(line.unitPrice);
      const qty = line.quantity;
      const discount = new Prisma.Decimal(line.discount);
      const grossAmount = unitPrice.mul(qty);
      const lineSubtotal = grossAmount.sub(discount);
      const taxRate = new Prisma.Decimal(line.ivaRate);
      const taxAmount = lineSubtotal.mul(taxRate).div(100).toDecimalPlaces(2);
      const lineTotal = lineSubtotal.add(taxAmount);

      subtotal = subtotal.add(lineSubtotal);
      taxTotal = taxTotal.add(taxAmount);
      discountTotal = discountTotal.add(discount);

      itemsData.push({
        productId: product?.id ?? "",
        quantity: qty,
        price: unitPrice,
        discountAmount: discount,
        taxRate,
        taxAmount,
        total: lineTotal,
        description: line.description || null,
      });
    }

    if (hasProductError) continue;

    if (itemsData.some((item) => !item.productId)) {
      errors.push(`Venta ${extRef}: tiene líneas sin producto asignado.`);
      continue;
    }

    const total = subtotal.add(taxTotal);
    totalAmount += Number(total);

    try {
      await prisma.lightweightSale.create({
        data: {
          tenantId,
          customerId,
          status: "paid",
          subtotal,
          taxTotal,
          discountTotal,
          total,
          paymentStatus: "paid",
          sriPaymentCode: null,
          notes: null,
          origin: "IMPORT",
          externalReference: extRef,
          originalIssuedAt: sale.date,
          importBatchId: batchId,
          items: {
            create: itemsData.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              discountAmount: item.discountAmount,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              total: item.total,
              description: item.description,
            })),
          },
          payments: {
            create: {
              method: sale.paymentMethod as
                | "cash"
                | "transfer"
                | "card"
                | "credit",
              amount: total,
            },
          },
        },
      });
      imported++;
    } catch (err) {
      errors.push(
        `Venta ${extRef}: ${err instanceof Error ? err.message : "error al crear."}`,
      );
    }
  }

  await prisma.salesImportBatch.update({
    where: { id: batchId },
    data: {
      status: errors.length > 0 ? (imported > 0 ? "PARTIAL" : "FAILED") : "COMPLETED",
      importedSales: imported,
      totalAmount: new Prisma.Decimal(totalAmount),
      completedAt: new Date(),
    },
  });

  return { imported, skipped, errors, totalAmount };
}

// ── Template Generation ──────────────────────────────────────────────────────

export function generateSalesImportTemplate(): string {
  const header = SALES_IMPORT_COLUMNS.join(",");
  const exampleRows = [
    "V001,10/10/2026,1712345678001,Juan Pérez,PROD01,Producto A,2,10.00,0,15,transfer,",
    "V001,10/10/2026,1712345678001,Juan Pérez,PROD02,Producto B,1,5.00,0,0,transfer,",
    "V002,11/10/2026,,Consumidor final,PROD03,Servicio X,1,25.00,0,15,cash,",
  ];
  return [header, ...exampleRows].join("\n");
}

// ── Delete Batch ─────────────────────────────────────────────────────────────

export async function deleteImportBatch(
  tenantId: string,
  batchId: string,
): Promise<{ deleted: number }> {
  const prisma = getPrismaClient();

  const batch = await prisma.salesImportBatch.findFirst({
    where: { id: batchId, tenantId },
  });

  if (!batch) {
    throw new Error("Lote no encontrado.");
  }

  const sriLinked = await prisma.sriDocument.count({
    where: {
      tenantId,
      sourceType: "BASIC_SALE",
      sourceId: {
        in: await prisma.lightweightSale
          .findMany({
            where: { tenantId, importBatchId: batchId, origin: "IMPORT" },
            select: { id: true },
          })
          .then((sales) => sales.map((s) => s.id)),
      },
    },
  });

  if (sriLinked > 0) {
    throw new Error(
      "No se puede eliminar: algunas ventas del lote tienen documentos SRI.",
    );
  }

  const { count } = await prisma.lightweightSale.deleteMany({
    where: {
      tenantId,
      importBatchId: batchId,
      origin: "IMPORT",
    },
  });

  await prisma.salesImportBatch.update({
    where: { id: batchId },
    data: { status: "FAILED", importedSales: 0 },
  });

  return { deleted: count };
}
