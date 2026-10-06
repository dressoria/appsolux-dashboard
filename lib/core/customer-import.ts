import "@/lib/security/server-only";
import ExcelJS from "exceljs";
import { validateCustomerIdentification } from "@/lib/core/customer-fiscal";

export const customerColumns = ["identificationType", "identification", "name", "tradeName", "email", "phone", "address", "country", "province", "city", "parish", "sector", "zone", "customerType", "customerOrigin", "groupName", "notes"] as const;
export type CustomerImportRow = Record<(typeof customerColumns)[number], string>;

export async function readCustomerImport(file: File): Promise<CustomerImportRow[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  let records: string[][];
  if (file.name.toLowerCase().endsWith(".csv")) records = buffer.toString("utf8").split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  else {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as never); const sheet = workbook.worksheets[0];
    records = []; sheet?.eachRow((row) => records.push((row.values as unknown[]).slice(1).map((value) => String(value ?? ""))));
  }
  const headers = records.shift()?.map((header) => header.trim()) ?? [];
  return records.map((values) => Object.fromEntries(customerColumns.map((column) => [column, values[headers.indexOf(column)]?.trim() ?? ""])) as CustomerImportRow);
}

function parseCsvLine(line: string) { const output: string[] = []; let value = "", quoted = false; for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === '"' && line[index + 1] === '"') { value += '"'; index++; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { output.push(value); value = ""; } else value += char; } output.push(value); return output; }

export function validateImportRows(rows: CustomerImportRow[], existing: Set<string>) {
  const seen = new Set<string>(); const issues: Array<{ row: number; level: "warning" | "error"; message: string }> = [];
  rows.forEach((row, index) => { const number = index + 2; if (!row.name) issues.push({ row: number, level: "error", message: "Razón social / nombre es obligatorio." }); const type = row.identificationType as "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID"; if (!type || !row.identification) issues.push({ row: number, level: "error", message: "Tipo e identificación son obligatorios." }); else try { const normalized = validateCustomerIdentification(type, row.identification); row.identification = normalized; if (seen.has(normalized)) issues.push({ row: number, level: "error", message: "Identificación duplicada dentro del archivo." }); if (existing.has(normalized)) issues.push({ row: number, level: "error", message: "La identificación ya existe en esta empresa." }); seen.add(normalized); } catch (error) { issues.push({ row: number, level: "error", message: error instanceof Error ? error.message : "Identificación inválida." }); } if (!row.email) issues.push({ row: number, level: "warning", message: "No tiene correo principal." }); });
  const errorRows = new Set(issues.filter((issue) => issue.level === "error").map((issue) => issue.row)); const warningRows = new Set(issues.filter((issue) => issue.level === "warning" && !errorRows.has(issue.row)).map((issue) => issue.row));
  return { rows, issues, errors: errorRows.size, warnings: warningRows.size, valid: rows.length - errorRows.size };
}
