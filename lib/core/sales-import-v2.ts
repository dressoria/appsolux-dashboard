import "@/lib/security/server-only";

import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import {
  parseMoney,
  parseImportDate,
  isValidSerieComprobante,
  isValidAccessKey,
  normalizeDocumentType,
  normalizeIdentificationType,
  parseTaxRate,
} from "./sales-import-parsers";
import { IMPORT_COLUMNS, type ImportColumnKey } from "./sales-import-template";

// ── Types ────────────────────────────────────────────────────────────────────

export type ImportRawRow = Record<ImportColumnKey, unknown>;

export type DocumentPreview = {
  serie: string;
  documentType: string;
  accessKey: string | null;
  issueDate: string;
  customerName: string;
  customerIdentification: string;
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  status: "VALID" | "WARNING" | "ERROR" | "DUPLICATE";
  messages: string[];
};

export type ImportPreview = {
  documents: DocumentPreview[];
  totalDocuments: number;
  totalRows: number;
  validDocuments: number;
  warningDocuments: number;
  errorDocuments: number;
  duplicateDocuments: number;
  totalAmount: number;
};

type ParsedRow = {
  rowNum: number;
  comprobante: string;
  serie: string;
  claveAcceso: string | null;
  fechaAutorizacion: Date | null;
  fechaEmision: Date | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  tipoId: string;
  identificacion: string;
  nombreCliente: string;
  codigoProducto: string | null;
  tipoImpuesto: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  descuento: number | null;
  observacionProducto: string | null;
  observacionFactura: string | null;
};

type GroupedDocument = {
  serie: string;
  documentType: string;
  accessKey: string | null;
  fechaAutorizacion: Date | null;
  fechaEmision: Date;
  subtotal: number;
  iva: number;
  total: number;
  tipoId: string;
  identificacion: string;
  nombreCliente: string;
  observacionFactura: string | null;
  rows: ParsedRow[];
};

// ── File Reading ─────────────────────────────────────────────────────────────

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

export async function readImportFile(
  buffer: Buffer,
  fileName: string,
): Promise<ImportRawRow[]> {
  let records: unknown[][];

  if (fileName.toLowerCase().endsWith(".csv")) {
    records = Buffer.from(buffer)
      .toString("utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => parseCsvLine(line) as unknown[]);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet("VENTAS") ?? workbook.worksheets[0];
    records = [];
    sheet?.eachRow((row) =>
      records.push((row.values as unknown[]).slice(1)),
    );
  }

  const rawHeaders = records.shift() ?? [];
  const headers = (rawHeaders as unknown[]).map((h) =>
    String(h ?? "").trim().toUpperCase().replace(/\s+/g, "_"),
  );

  return records.map((values) =>
    Object.fromEntries(
      IMPORT_COLUMNS.map((col) => {
        const idx = headers.indexOf(col);
        return [col, idx >= 0 ? values[idx] : null];
      }),
    ) as ImportRawRow,
  );
}

// ── Row Parsing ──────────────────────────────────────────────────────────────

function parseRow(row: ImportRawRow, rowNum: number): { parsed: ParsedRow; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const serie = String(row.SERIE_COMPROBANTE ?? "").trim();
  if (!serie) {
    errors.push("SERIE_COMPROBANTE es obligatorio.");
  } else if (!isValidSerieComprobante(serie)) {
    errors.push("SERIE_COMPROBANTE debe tener formato 001-100-000011434.");
  }

  const claveRaw = String(row.CLAVE_ACCESO ?? "").trim();
  let claveAcceso: string | null = null;
  if (claveRaw) {
    if (isValidAccessKey(claveRaw)) {
      claveAcceso = claveRaw;
    } else {
      errors.push("CLAVE_ACCESO debe ser exactamente 49 dígitos.");
    }
  }

  const comprobante = normalizeDocumentType(String(row.COMPROBANTE ?? ""));

  const fechaAutorizacion = row.FECHA_AUTORIZACION ? parseImportDate(row.FECHA_AUTORIZACION) : null;

  const fechaEmision = parseImportDate(row.FECHA_EMISION);
  if (!fechaEmision) {
    errors.push("FECHA_EMISION es obligatoria y tiene formato inválido.");
  }

  const subtotal = parseMoney(row.VALOR_SIN_IMPUESTOS);
  if (subtotal === null) errors.push("VALOR_SIN_IMPUESTOS es obligatorio.");

  const iva = parseMoney(row.IVA);
  if (iva === null) errors.push("IVA es obligatorio.");

  const total = parseMoney(row.IMPORTE_TOTAL);
  if (total === null) errors.push("IMPORTE_TOTAL es obligatorio.");

  if (subtotal !== null && iva !== null && total !== null) {
    const diff = Math.abs((subtotal + iva) - total);
    if (diff > 0.02) {
      errors.push(`Totales no cuadran: ${subtotal} + ${iva} ≠ ${total} (diff=${diff.toFixed(2)}).`);
    }
  }

  const tipoIdRaw = String(row.TIPO_IDENTIFICACION ?? "").trim();
  if (!tipoIdRaw) errors.push("TIPO_IDENTIFICACION es obligatorio.");
  const tipoId = normalizeIdentificationType(tipoIdRaw || "CEDULA");

  const identificacion = String(row.IDENTIFICACION_CLIENTE ?? "").trim();
  if (!identificacion) errors.push("IDENTIFICACION_CLIENTE es obligatorio.");

  const nombreCliente = String(row.NOMBRE_CLIENTE ?? "").trim();
  if (!nombreCliente) errors.push("NOMBRE_CLIENTE es obligatorio.");

  const codigoProducto = String(row.CODIGO_PRODUCTO ?? "").trim() || null;

  let tipoImpuesto: string | null = null;
  let cantidad: number | null = null;
  let precioUnitario: number | null = null;
  let descuento: number | null = null;

  if (codigoProducto) {
    const tiRaw = String(row.TIPO_IMPUESTO ?? "").trim();
    if (!tiRaw) {
      errors.push("TIPO_IMPUESTO es obligatorio cuando hay producto.");
    }
    tipoImpuesto = tiRaw || null;

    cantidad = parseMoney(row.CANTIDAD);
    if (cantidad === null || cantidad <= 0) {
      errors.push("CANTIDAD es obligatoria y debe ser positiva cuando hay producto.");
    }

    precioUnitario = parseMoney(row.PRECIO_UNITARIO);
    if (precioUnitario === null) {
      errors.push("PRECIO_UNITARIO es obligatorio cuando hay producto.");
    }

    const descRaw = parseMoney(row.DESCUENTO_VALOR);
    if (descRaw === null) {
      errors.push("DESCUENTO_VALOR es obligatorio cuando hay producto.");
    } else if (descRaw < 0) {
      errors.push("DESCUENTO_VALOR no puede ser negativo.");
    } else {
      descuento = descRaw;
      if (cantidad !== null && precioUnitario !== null && descuento > cantidad * precioUnitario) {
        errors.push("DESCUENTO_VALOR no puede exceder el bruto de la línea.");
      }
    }
  }

  return {
    parsed: {
      rowNum,
      comprobante,
      serie,
      claveAcceso,
      fechaAutorizacion,
      fechaEmision,
      subtotal,
      iva,
      total,
      tipoId,
      identificacion,
      nombreCliente,
      codigoProducto,
      tipoImpuesto,
      cantidad,
      precioUnitario,
      descuento,
      observacionProducto: String(row.OBSERVACION_PRODUCTO ?? "").trim() || null,
      observacionFactura: String(row.OBSERVACION_FACTURA ?? "").trim() || null,
    },
    errors,
    warnings,
  };
}

// ── Grouping + Validation ────────────────────────────────────────────────────

export async function buildImportPreview(
  tenantId: string,
  rows: ImportRawRow[],
): Promise<ImportPreview> {
  const prisma = getPrismaClient();

  // Parse all rows
  const parsed: { row: ParsedRow; errors: string[]; warnings: string[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const { parsed: p, errors, warnings } = parseRow(rows[i], i + 2);
    parsed.push({ row: p, errors, warnings });
  }

  // Group by SERIE_COMPROBANTE
  const groups = new Map<string, { rows: typeof parsed; headerRow: (typeof parsed)[0] }>();
  for (const entry of parsed) {
    const key = entry.row.serie;
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { rows: [], headerRow: entry };
      groups.set(key, group);
    }
    group.rows.push(entry);
  }

  // Check for existing documents (dedup)
  const allSeries = [...groups.keys()];
  const allAccessKeys = parsed
    .map((p) => p.row.claveAcceso)
    .filter((k): k is string => k !== null);

  const existingBySerie = new Set<string>();
  const existingByAccessKey = new Set<string>();

  if (allSeries.length > 0) {
    const existing = await prisma.externalSalesDocument.findMany({
      where: { tenantId, documentNumber: { in: allSeries } },
      select: { documentNumber: true },
    });
    for (const d of existing) existingBySerie.add(d.documentNumber);
  }

  if (allAccessKeys.length > 0) {
    const existing = await prisma.externalSalesDocument.findMany({
      where: { tenantId, accessKey: { in: allAccessKeys } },
      select: { accessKey: true },
    });
    for (const d of existing) {
      if (d.accessKey) existingByAccessKey.add(d.accessKey);
    }

    // Also check SriDocument for local Facturom documents
    const sriDocs = await prisma.sriDocument.findMany({
      where: { tenantId, accessKey: { in: allAccessKeys } },
      select: { accessKey: true },
    });
    for (const d of sriDocs) {
      if (d.accessKey) existingByAccessKey.add(d.accessKey);
    }
  }

  // Also check legacy LightweightSale imports
  if (allSeries.length > 0) {
    const legacySales = await prisma.lightweightSale.findMany({
      where: { tenantId, origin: "IMPORT", externalReference: { in: allSeries } },
      select: { externalReference: true },
    });
    for (const s of legacySales) {
      if (s.externalReference) existingBySerie.add(s.externalReference);
    }
  }

  // Check for product codes
  const productCodes = [...new Set(parsed.map((p) => p.row.codigoProducto).filter((c): c is string => c !== null))];
  const productCodeSet = new Set<string>();
  if (productCodes.length > 0) {
    const products = await prisma.lightweightProduct.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { primaryCode: { in: productCodes } },
          { auxiliaryCode: { in: productCodes } },
          { barcode: { in: productCodes } },
        ],
      },
      select: { primaryCode: true, auxiliaryCode: true, barcode: true },
    });
    for (const p of products) {
      if (p.primaryCode) productCodeSet.add(p.primaryCode);
      if (p.auxiliaryCode) productCodeSet.add(p.auxiliaryCode);
      if (p.barcode) productCodeSet.add(p.barcode);
    }
  }

  // Build document previews
  const documents: DocumentPreview[] = [];

  for (const [serie, group] of groups) {
    const messages: string[] = [];
    let status: DocumentPreview["status"] = "VALID";

    // Check dedup
    const ak = group.rows[0]?.row.claveAcceso;
    if (ak && existingByAccessKey.has(ak)) {
      status = "DUPLICATE";
      messages.push("Ya existe en Facturom (clave de acceso).");
    } else if (existingBySerie.has(serie)) {
      status = "DUPLICATE";
      messages.push("Ya importado anteriormente (serie).");
    }

    // Collect all row-level errors
    let hasRowErrors = false;
    for (const entry of group.rows) {
      if (entry.errors.length > 0) {
        hasRowErrors = true;
        for (const err of entry.errors) {
          messages.push(`Fila ${entry.row.rowNum}: ${err}`);
        }
      }
      for (const warn of entry.warnings) {
        messages.push(`Fila ${entry.row.rowNum}: ${warn}`);
      }
    }

    if (hasRowErrors && status !== "DUPLICATE") status = "ERROR";

    // Check product linking
    for (const entry of group.rows) {
      if (entry.row.codigoProducto && !productCodeSet.has(entry.row.codigoProducto)) {
        messages.push(`Fila ${entry.row.rowNum}: Producto "${entry.row.codigoProducto}" no vinculado al catálogo.`);
        if (status !== "DUPLICATE" && status !== "ERROR") status = "WARNING";
      }
    }

    // Validate header consistency
    const headers = group.rows.map((r) => r.row);
    const ref = headers[0];
    for (let i = 1; i < headers.length; i++) {
      const h = headers[i];
      if (h.comprobante !== ref.comprobante) {
        messages.push("COMPROBANTE difiere entre filas de la misma serie.");
        if (status !== "DUPLICATE") status = "ERROR";
      }
      if (h.claveAcceso !== ref.claveAcceso) {
        messages.push("CLAVE_ACCESO difiere entre filas de la misma serie.");
        if (status !== "DUPLICATE") status = "ERROR";
      }
      if (h.identificacion !== ref.identificacion || h.nombreCliente !== ref.nombreCliente) {
        messages.push("Datos de cliente difieren entre filas de la misma serie.");
        if (status !== "DUPLICATE") status = "ERROR";
      }
      const ofa = h.observacionFactura;
      const ofb = ref.observacionFactura;
      if (ofa && ofb && ofa !== ofb) {
        messages.push("OBSERVACION_FACTURA difiere entre filas de la misma serie.");
        if (status !== "DUPLICATE") status = "ERROR";
      }
    }

    documents.push({
      serie,
      documentType: ref.comprobante,
      accessKey: ref.claveAcceso,
      issueDate: ref.fechaEmision?.toISOString() ?? "",
      customerName: ref.nombreCliente,
      customerIdentification: ref.identificacion,
      subtotal: ref.subtotal ?? 0,
      tax: ref.iva ?? 0,
      total: ref.total ?? 0,
      itemCount: group.rows.filter((r) => r.row.codigoProducto).length,
      status,
      messages: messages.length > 0 ? messages : ["OK"],
    });
  }

  const validDocs = documents.filter((d) => d.status === "VALID").length;
  const warningDocs = documents.filter((d) => d.status === "WARNING").length;
  const errorDocs = documents.filter((d) => d.status === "ERROR").length;
  const dupeDocs = documents.filter((d) => d.status === "DUPLICATE").length;
  const totalAmount = documents
    .filter((d) => d.status !== "ERROR")
    .reduce((sum, d) => sum + d.total, 0);

  return {
    documents,
    totalDocuments: documents.length,
    totalRows: rows.length,
    validDocuments: validDocs,
    warningDocuments: warningDocs,
    errorDocuments: errorDocs,
    duplicateDocuments: dupeDocs,
    totalAmount,
  };
}

// ── Import Execution ─────────────────────────────────────────────────────────

export async function confirmImportV2(
  tenantId: string,
  userId: string,
  batchId: string,
  rows: ImportRawRow[],
): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
  totalAmount: number;
}> {
  const prisma = getPrismaClient();

  // Parse and group
  const parsed = rows.map((row, i) => parseRow(row, i + 2));
  const groups = new Map<string, typeof parsed>();
  for (const entry of parsed) {
    const key = entry.parsed.serie;
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(entry);
  }

  // Pre-fetch product codes for linking
  const productCodes = [...new Set(parsed.map((p) => p.parsed.codigoProducto).filter((c): c is string => c !== null))];
  const productByCode = new Map<string, string>();
  if (productCodes.length > 0) {
    const products = await prisma.lightweightProduct.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { primaryCode: { in: productCodes } },
          { auxiliaryCode: { in: productCodes } },
          { barcode: { in: productCodes } },
        ],
      },
      select: { id: true, primaryCode: true, auxiliaryCode: true, barcode: true },
    });
    for (const p of products) {
      if (p.primaryCode) productByCode.set(p.primaryCode, p.id);
      if (p.auxiliaryCode) productByCode.set(p.auxiliaryCode, p.id);
      if (p.barcode) productByCode.set(p.barcode, p.id);
    }
  }

  // Pre-fetch customer ids
  const customerIds = [...new Set(parsed.map((p) => p.parsed.identificacion).filter(Boolean))];
  const customerByIdentification = new Map<string, string>();
  if (customerIds.length > 0) {
    const customers = await prisma.lightweightCustomer.findMany({
      where: { tenantId, identification: { in: customerIds } },
      select: { id: true, identification: true },
    });
    for (const c of customers) {
      if (c.identification) customerByIdentification.set(c.identification, c.id);
    }
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  let totalAmount = 0;

  for (const [serie, group] of groups) {
    const ref = group[0].parsed;

    // Skip docs with errors
    if (group.some((e) => e.errors.length > 0)) {
      continue;
    }

    // Skip if missing required header fields
    if (!ref.fechaEmision || ref.subtotal === null || ref.iva === null || ref.total === null) {
      continue;
    }

    // Dedup check
    try {
      const existsByNumber = await prisma.externalSalesDocument.findUnique({
        where: {
          tenantId_documentType_documentNumber: {
            tenantId,
            documentType: ref.comprobante as "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE",
            documentNumber: serie,
          },
        },
        select: { id: true },
      });
      if (existsByNumber) { skipped++; continue; }

      if (ref.claveAcceso) {
        const existsByKey = await prisma.externalSalesDocument.findUnique({
          where: { tenantId_accessKey: { tenantId, accessKey: ref.claveAcceso } },
          select: { id: true },
        });
        if (existsByKey) { skipped++; continue; }

        const sriDoc = await prisma.sriDocument.findFirst({
          where: { tenantId, accessKey: ref.claveAcceso },
          select: { id: true },
        });
        if (sriDoc) { skipped++; continue; }
      }

      // Also check legacy imports
      const legacyExists = await prisma.lightweightSale.findFirst({
        where: { tenantId, origin: "IMPORT", externalReference: serie },
        select: { id: true },
      });
      if (legacyExists) { skipped++; continue; }
    } catch {
      // Continue on dedup check failure
    }

    const customerId = customerByIdentification.get(ref.identificacion) ?? null;

    // Build items
    const itemRows = group.filter((e) => e.parsed.codigoProducto);
    const itemsData: Prisma.ExternalSalesDocumentItemCreateWithoutDocumentInput[] = itemRows.map((e) => {
      const r = e.parsed;
      const { taxRate, taxCategory } = parseTaxRate(r.tipoImpuesto ?? "0");
      const qty = r.cantidad ?? 0;
      const price = r.precioUnitario ?? 0;
      const disc = r.descuento ?? 0;
      const lineSubtotal = qty * price - disc;
      const lineTax = lineSubtotal * (taxRate / 100);
      const lineTotal = lineSubtotal + lineTax;

      return {
        productId: r.codigoProducto ? (productByCode.get(r.codigoProducto) ?? null) : null,
        productCode: r.codigoProducto,
        productName: r.codigoProducto,
        taxCategory: taxCategory as Prisma.ExternalSalesDocumentItemCreateWithoutDocumentInput["taxCategory"],
        taxRate: new Prisma.Decimal(taxRate),
        quantity: new Prisma.Decimal(qty),
        unitPrice: new Prisma.Decimal(price),
        discountAmount: new Prisma.Decimal(disc),
        subtotal: new Prisma.Decimal(Number(lineSubtotal.toFixed(2))),
        taxAmount: new Prisma.Decimal(Number(lineTax.toFixed(2))),
        total: new Prisma.Decimal(Number(lineTotal.toFixed(2))),
        observation: r.observacionProducto,
      };
    });

    try {
      await prisma.externalSalesDocument.create({
        data: {
          tenantId,
          source: "MANUAL_IMPORT",
          documentType: ref.comprobante as "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE",
          documentNumber: serie,
          accessKey: ref.claveAcceso,
          authorizationDate: ref.fechaAutorizacion,
          issueDate: ref.fechaEmision,
          customerIdentificationType: ref.tipoId,
          customerIdentification: ref.identificacion,
          customerName: ref.nombreCliente,
          customerId,
          subtotal: new Prisma.Decimal(ref.subtotal),
          taxTotal: new Prisma.Decimal(ref.iva),
          total: new Prisma.Decimal(ref.total),
          observation: ref.observacionFactura,
          status: "IMPORTED",
          importBatchId: batchId,
          createdByUserId: userId,
          items: itemsData.length > 0 ? { create: itemsData } : undefined,
        },
      });
      imported++;
      totalAmount += ref.total;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error desconocido";
      if (msg.includes("Unique constraint")) {
        skipped++;
      } else {
        errors.push(`${serie}: ${msg}`);
      }
    }
  }

  await prisma.salesImportBatch.update({
    where: { id: batchId },
    data: {
      status: errors.length > 0 ? (imported > 0 ? "PARTIAL" : "FAILED") : "COMPLETED",
      importedSales: imported,
      totalDocuments: groups.size,
      totalAmount: new Prisma.Decimal(totalAmount),
      completedAt: new Date(),
    },
  });

  return { imported, skipped, errors, totalAmount };
}
