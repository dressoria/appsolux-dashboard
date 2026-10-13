import "@/lib/security/server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  amount,
  choice,
  date,
  money,
  text,
  TreasuryError,
  obligationState,
} from "./domain";
import { audit, financialTransaction, type Actor, type Tx } from "./db";

export type ImportRow = Record<string, string>;
const normalize = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function parseCsv(content: string): string[][] {
  const first = content.split(/\r?\n/)[0] ?? "";
  const delimiter =
    first.split(";").length > first.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (quoted && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === "\n" || c === "\r")) {
      row.push(cell);
      cell = "";
      if (c !== delimiter) {
        if (c === "\r" && content[i + 1] === "\n") i++;
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw new TreasuryError("CSV con comillas sin cerrar.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export async function readImportFile(file: File): Promise<ImportRow[]> {
  if (file.size > 4 * 1024 * 1024)
    throw new TreasuryError("El archivo no puede superar 4 MB.");
  let matrix: string[][];
  if (/\.csv$/i.test(file.name)) matrix = parseCsv(await file.text());
  else if (/\.xlsx$/i.test(file.name)) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      throw new TreasuryError(
        "No se pudo leer el XLSX. Verifica que sea un archivo válido y sin contraseña.",
      );
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 1001 || sheet.columnCount > 30)
      throw new TreasuryError(
        "El archivo debe contener como máximo 1000 filas y 30 columnas.",
      );
    matrix = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      for (let i = 1; i <= sheet.columnCount; i++) {
        const value = row.getCell(i).value;
        if (value && typeof value === "object" && !(value instanceof Date))
          throw new TreasuryError(
            "Usa valores simples, sin fórmulas ni celdas enriquecidas.",
          );
        values.push(
          value instanceof Date
            ? value.toISOString().slice(0, 10)
            : value === null
              ? ""
              : String(value),
        );
      }
      matrix.push(values);
    });
  } else throw new TreasuryError("Solo se aceptan CSV y XLSX.");
  if (matrix.length < 2 || matrix.length > 1001)
    throw new TreasuryError(
      "El archivo debe contener encabezados y entre 1 y 1000 registros.",
    );
  const headers = matrix[0].map(normalize);
  if (new Set(headers).size !== headers.length)
    throw new TreasuryError("Hay encabezados repetidos.");
  return matrix
    .slice(1)
    .map((row) =>
      Object.fromEntries(
        headers.map((header, i) => [header, row[i]?.trim() ?? ""]),
      ),
    );
}
export function readRows(value: unknown): ImportRow[] {
  if (!Array.isArray(value) || !value.length || value.length > 1000)
    throw new TreasuryError("Importación inválida; máximo 1000 filas.");
  return value.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      Object.keys(row).length > 30
    )
      throw new TreasuryError("Fila inválida.");
    const result: ImportRow = {};
    for (const [key, cell] of Object.entries(row)) {
      if (typeof cell !== "string" || cell.length > 2000)
        throw new TreasuryError("Celda inválida.");
      result[normalize(key)] = cell.trim();
    }
    return result;
  });
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function previewObligations(
  tenantId: string,
  rows: ImportRow[],
  db: Pick<
    Tx,
    "lightweightCustomer" | "lightweightSupplier" | "treasuryObligation"
  > = getPrismaClient(),
) {
  const errors: { row: number; message: string }[] = [],
    warnings: { row: number; message: string }[] = [];
  const records: {
    row: number;
    data: {
      tenantId: string;
      type: "RECEIVABLE" | "PAYABLE";
      customerId: string | null;
      supplierId: string | null;
      issueDate: Date;
      dueDate: Date;
      originalAmount: ReturnType<typeof amount>;
      paidAmount: ReturnType<typeof amount>;
      balance: ReturnType<typeof amount>;
      status: ReturnType<typeof obligationState>["status"];
      documentNumber: string;
      externalReference: string;
      notes: string | null;
    };
  }[] = [];
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    try {
      const type = choice(row.tipo, ["RECEIVABLE", "PAYABLE"] as const);
      const identification = text(row.identificacion, "Identificación")!;
      text(row.nombre, "Nombre");
      const party =
        type === "RECEIVABLE"
          ? await db.lightweightCustomer.findFirst({
              where: { tenantId, identification, isActive: true },
            })
          : await db.lightweightSupplier.findFirst({
              where: { tenantId, identification, isActive: true },
            });
      if (!party)
        throw new TreasuryError(
          "El cliente/proveedor no existe en esta empresa. Regístralo antes de importar.",
        );
      const documentNumber = text(row.numero_documento, "Número de documento")!,
        issueDate = date(row.fecha_emision),
        dueDate = date(row.fecha_vencimiento);
      if (dueDate < issueDate)
        throw new TreasuryError("Vencimiento anterior a la emisión.");
      const originalAmount = amount(row.valor_original),
        balance = amount(row.saldo_pendiente, true);
      if (balance.gt(originalAmount))
        throw new TreasuryError("El saldo pendiente supera el valor original.");
      const externalReference = `import:${hash(`${type}|${party.id}|${documentNumber}|${issueDate.toISOString()}`)}`;
      if (seen.has(externalReference))
        throw new TreasuryError("Obligación repetida dentro del archivo.");
      seen.add(externalReference);
      if (
        await db.treasuryObligation.findUnique({
          where: {
            tenantId_type_externalReference: {
              tenantId,
              type,
              externalReference,
            },
          },
        })
      )
        warnings.push({
          row: index + 2,
          message: "Ya importada; se omitirá sin modificar el saldo existente.",
        });
      const paidAmount = originalAmount.minus(balance);
      records.push({
        row: index + 2,
        data: {
          tenantId,
          type,
          customerId: type === "RECEIVABLE" ? party.id : null,
          supplierId: type === "PAYABLE" ? party.id : null,
          issueDate,
          dueDate,
          originalAmount,
          paidAmount,
          ...obligationState(originalAmount, paidAmount, dueDate),
          documentNumber,
          externalReference,
          notes: text(row.observacion, "Observación", false, 2000),
        },
      });
    } catch (error) {
      if (!(error instanceof TreasuryError)) throw error;
      errors.push({ row: index + 2, message: error.message });
    }
  }
  return { rows, records, errors, warnings, valid: errors.length === 0 };
}
export async function confirmObligations(actor: Actor, rows: ImportRow[]) {
  return financialTransaction(async (tx) => {
    const preview = await previewObligations(actor.tenantId, rows, tx);
    if (!preview.valid)
      throw new TreasuryError(
        preview.errors.map((e) => `Fila ${e.row}: ${e.message}`).join("; "),
      );
    const importBatchId = hash(JSON.stringify(rows));
    let imported = 0;
    for (const record of preview.records) {
      if (
        await tx.treasuryObligation.findUnique({
          where: {
            tenantId_type_externalReference: {
              tenantId: actor.tenantId,
              type: record.data.type,
              externalReference: record.data.externalReference,
            },
          },
        })
      )
        continue;
      await tx.treasuryObligation.create({
        data: {
          ...record.data,
          documentType: "IMPORTED_OPENING_BALANCE",
          importBatchId,
          createdByUserId: actor.userId,
        },
      });
      imported++;
    }
    await audit(
      tx,
      actor,
      "obligations_imported",
      "TreasuryImport",
      importBatchId,
      { imported, skipped: rows.length - imported },
    );
    return { imported, skipped: rows.length - imported, importBatchId };
  });
}
export function previewStatement(rows: ImportRow[], start: Date, end: Date) {
  const errors: { row: number; message: string }[] = [];
  const lines: {
    date: Date;
    description: string;
    reference: string | null;
    amount: ReturnType<typeof amount>;
    direction: "IN" | "OUT";
    importKey: string;
  }[] = [];
  const occurrences = new Map<string, number>();
  for (const [index, row] of rows.entries()) {
    try {
      const at = date(row.fecha);
      if (at < start || at >= end)
        throw new TreasuryError("Fecha fuera del período de conciliación.");
      const value = amount(row.monto),
        direction = choice(row.direccion, ["IN", "OUT"] as const),
        description = text(row.descripcion, "Descripción")!,
        reference = text(row.referencia, "Referencia", false);
      const fingerprint = hash(
          `${at.toISOString()}|${direction}|${money(value)}|${reference ?? ""}|${description}`,
        ),
        occurrence = occurrences.get(fingerprint) ?? 0;
      occurrences.set(fingerprint, occurrence + 1);
      lines.push({
        date: at,
        description,
        reference,
        amount: value,
        direction,
        importKey: `${fingerprint}:${occurrence}`,
      });
    } catch (error) {
      if (!(error instanceof TreasuryError)) throw error;
      errors.push({ row: index + 2, message: error.message });
    }
  }
  return { rows, lines, errors, valid: errors.length === 0 };
}
