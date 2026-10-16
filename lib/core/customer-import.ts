import "@/lib/security/server-only";
import ExcelJS from "exceljs";
import { validateCustomerIdentification } from "@/lib/core/customer-fiscal";

export const customerColumns = ["identificationType", "identification", "name", "tradeName", "email", "phone", "address", "country", "province", "city", "parish", "sector", "zone", "customerType", "customerOrigin", "groupName", "notes"] as const;
export type CustomerImportRow = Record<(typeof customerColumns)[number], string>;

export type ImportRowStatus = "READY" | "SKIP_EXISTING" | "SKIP_DUPLICATE_FILE" | "NEEDS_REVIEW" | "EXCLUDED";

export type ImportRowIssue = {
  field: string;
  message: string;
};

export type ImportPreviewRow = {
  rowNumber: number;
  data: CustomerImportRow;
  status: ImportRowStatus;
  issues: ImportRowIssue[];
  selectedForImport: boolean;
  autofilledFields: string[];
};

export type ImportPreviewResult = {
  rows: ImportPreviewRow[];
  counts: {
    ready: number;
    skipExisting: number;
    skipDuplicateFile: number;
    needsReview: number;
  };
};

const DEFAULT_EMAIL = "systemworkfacturaelectronica@gmail.com";
const DEFAULT_PHONE = "9999999999";
const DEFAULT_ADDRESS = "SIN DIRECCIÓN";
const DEFAULT_COUNTRY = "Ecuador";
const MAX_IMPORT_ROWS = 2000;

export { DEFAULT_EMAIL, DEFAULT_PHONE, DEFAULT_ADDRESS, DEFAULT_COUNTRY, MAX_IMPORT_ROWS };

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

function inferIdentificationType(identification: string): string | null {
  const digits = identification.replace(/\D/g, "");
  if (digits.length === 10 && /^\d{10}$/.test(identification.trim())) return "CEDULA";
  if (digits.length === 13 && /^\d{13}$/.test(identification.trim())) return "RUC";
  return null;
}

function normalizeRow(row: CustomerImportRow): { data: CustomerImportRow; autofilledFields: string[] } {
  const data = { ...row };
  const autofilledFields: string[] = [];

  data.name = data.name.trim();
  data.tradeName = data.tradeName?.trim() ?? "";
  data.identification = data.identification.trim();
  data.identificationType = data.identificationType.trim().toUpperCase();
  data.email = data.email?.trim().toLowerCase() ?? "";
  data.phone = data.phone?.trim() ?? "";
  data.address = data.address?.trim() ?? "";
  data.country = data.country?.trim() ?? "";
  data.province = data.province?.trim() ?? "";
  data.city = data.city?.trim() ?? "";

  if (!data.name && data.tradeName) {
    data.name = data.tradeName;
    autofilledFields.push("name");
  }

  if (!data.email) {
    data.email = DEFAULT_EMAIL;
    autofilledFields.push("email");
  }

  if (!data.phone) {
    data.phone = DEFAULT_PHONE;
    autofilledFields.push("phone");
  }

  if (!data.address) {
    data.address = DEFAULT_ADDRESS;
    autofilledFields.push("address");
  }

  if (!data.country) {
    data.country = DEFAULT_COUNTRY;
    autofilledFields.push("country");
  }

  if (!data.identificationType && data.identification) {
    const inferred = inferIdentificationType(data.identification);
    if (inferred) {
      data.identificationType = inferred;
      autofilledFields.push("identificationType");
    }
  }

  return { data, autofilledFields };
}

export function processImportRows(rows: CustomerImportRow[], existingIdentifications: Set<string>): ImportPreviewResult {
  const seenInFile = new Map<string, number>();
  const result: ImportPreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const { data, autofilledFields } = normalizeRow(rows[i]);
    const issues: ImportRowIssue[] = [];
    let status: ImportRowStatus = "READY";

    if (!data.name) {
      issues.push({ field: "name", message: "Razón social / nombre es obligatorio." });
    }

    if (!data.identificationType && !data.identification) {
      issues.push({ field: "identificationType", message: "Tipo e identificación son obligatorios." });
      issues.push({ field: "identification", message: "Tipo e identificación son obligatorios." });
    } else if (!data.identificationType) {
      issues.push({ field: "identificationType", message: "No se pudo determinar el tipo de identificación." });
    } else if (!data.identification) {
      issues.push({ field: "identification", message: "Identificación es obligatoria." });
    } else {
      const type = data.identificationType as "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID";
      const validTypes = ["RUC", "CEDULA", "PASSPORT", "FOREIGN_ID"];
      if (!validTypes.includes(type)) {
        issues.push({ field: "identificationType", message: `Tipo de identificación inválido: ${type}` });
      } else {
        try {
          data.identification = validateCustomerIdentification(type, data.identification);
        } catch (error) {
          issues.push({ field: "identification", message: error instanceof Error ? error.message : "Identificación inválida." });
        }
      }
    }

    if (data.email && data.email !== DEFAULT_EMAIL) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        issues.push({ field: "email", message: "El formato del correo electrónico es inválido." });
      }
    }

    if (issues.length > 0) {
      status = "NEEDS_REVIEW";
    }

    const normalizedId = data.identification?.toUpperCase();
    if (normalizedId && status !== "NEEDS_REVIEW") {
      if (existingIdentifications.has(normalizedId) || existingIdentifications.has(data.identification)) {
        status = "SKIP_EXISTING";
      } else if (seenInFile.has(normalizedId)) {
        status = "SKIP_DUPLICATE_FILE";
      }
    }

    if (normalizedId && status !== "NEEDS_REVIEW") {
      if (!seenInFile.has(normalizedId)) {
        seenInFile.set(normalizedId, rowNumber);
      }
    }

    const selectedForImport = status === "READY" || status === "NEEDS_REVIEW";

    result.push({
      rowNumber,
      data,
      status,
      issues,
      selectedForImport,
      autofilledFields,
    });
  }

  const counts = {
    ready: result.filter((r) => r.status === "READY").length,
    skipExisting: result.filter((r) => r.status === "SKIP_EXISTING").length,
    skipDuplicateFile: result.filter((r) => r.status === "SKIP_DUPLICATE_FILE").length,
    needsReview: result.filter((r) => r.status === "NEEDS_REVIEW").length,
  };

  return { rows: result, counts };
}

export function revalidateRows(rows: ImportPreviewRow[], existingIdentifications: Set<string>): ImportPreviewResult {
  const rawRows = rows.map((r) => r.data);
  const result = processImportRows(rawRows, existingIdentifications);
  for (let i = 0; i < result.rows.length; i++) {
    if (rows[i].status === "EXCLUDED") {
      result.rows[i].status = "EXCLUDED";
      result.rows[i].selectedForImport = false;
    }
  }
  result.counts.ready = result.rows.filter((r) => r.status === "READY").length;
  return result;
}

export function validateImportRows(rows: CustomerImportRow[], existing: Set<string>) {
  const seen = new Set<string>(); const issues: Array<{ row: number; level: "warning" | "error"; message: string }> = [];
  rows.forEach((row, index) => { const number = index + 2; if (!row.name) issues.push({ row: number, level: "error", message: "Razón social / nombre es obligatorio." }); const type = row.identificationType as "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID"; if (!type || !row.identification) issues.push({ row: number, level: "error", message: "Tipo e identificación son obligatorios." }); else try { const normalized = validateCustomerIdentification(type, row.identification); row.identification = normalized; if (seen.has(normalized)) issues.push({ row: number, level: "error", message: "Identificación duplicada dentro del archivo." }); if (existing.has(normalized)) issues.push({ row: number, level: "error", message: "La identificación ya existe en esta empresa." }); seen.add(normalized); } catch (error) { issues.push({ row: number, level: "error", message: error instanceof Error ? error.message : "Identificación inválida." }); } if (!row.email) issues.push({ row: number, level: "warning", message: "No tiene correo principal." }); });
  const errorRows = new Set(issues.filter((issue) => issue.level === "error").map((issue) => issue.row)); const warningRows = new Set(issues.filter((issue) => issue.level === "warning" && !errorRows.has(issue.row)).map((issue) => issue.row));
  return { rows, issues, errors: errorRows.size, warnings: warningRows.size, valid: rows.length - errorRows.size };
}
