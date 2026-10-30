/**
 * Robust money and date parsers for Ecuador/Excel sales import.
 */

// ── Money Parser ────────────────────────────────────────────────────────────

export function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  if (raw == null) return null;

  let str = String(raw).trim();
  if (!str) return null;

  // Remove currency symbols and whitespace
  str = str.replace(/[$\s]/g, "");

  // Detect format:
  // European: 1.234,56  (dot as thousands, comma as decimal)
  // US:       1,234.56  (comma as thousands, dot as decimal)
  // Simple:   15,00 or 15.00

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  if (lastComma > lastDot) {
    // Comma is the decimal separator (European: 1.234,56 or just 15,00)
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Dot is the decimal separator (US: 1,234.56 or just 15.00)
    str = str.replace(/,/g, "");
  } else {
    // No decimal separator or both absent — just clean commas
    str = str.replace(/,/g, "");
  }

  const val = Number(str);
  if (!Number.isFinite(val) || val < 0) return null;
  return val;
}

// ── Date Parser ─────────────────────────────────────────────────────────────

const TZ_OFFSET = "-05:00"; // America/Guayaquil

function isExcelDate(value: unknown): value is number {
  return typeof value === "number" && value > 25000 && value < 60000;
}

function fromExcelDate(serial: number): Date {
  const utcDays = Math.floor(serial) - 25569;
  const utcMs = utcDays * 86400000;
  return new Date(utcMs);
}

function parseYear(y: string): number {
  const n = Number(y);
  if (y.length === 2) return n < 50 ? 2000 + n : 1900 + n;
  return n;
}

export function parseImportDate(raw: unknown): Date | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  if (isExcelDate(raw)) {
    const d = fromExcelDate(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // DD/MM/YY HH:MM or DD/MM/YYYY HH:MM:SS
  const dtMatch = str.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dtMatch) {
    const day = dtMatch[1].padStart(2, "0");
    const month = dtMatch[2].padStart(2, "0");
    const year = parseYear(dtMatch[3]);
    const hh = (dtMatch[4] ?? "00").padStart(2, "0");
    const mm = (dtMatch[5] ?? "00").padStart(2, "0");
    const ss = (dtMatch[6] ?? "00").padStart(2, "0");
    const d = new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}${TZ_OFFSET}`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00${TZ_OFFSET}`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

// ── Document Number Validator ───────────────────────────────────────────────

const SERIE_REGEX = /^\d{3}-\d{3}-\d{9}$/;

export function isValidSerieComprobante(value: string): boolean {
  return SERIE_REGEX.test(value);
}

// ── Access Key Validator ────────────────────────────────────────────────────

const ACCESS_KEY_REGEX = /^\d{49}$/;

export function isValidAccessKey(value: string): boolean {
  return ACCESS_KEY_REGEX.test(value);
}

// ── Document Type Normalizer ────────────────────────────────────────────────

const DOC_TYPE_MAP: Record<string, string> = {
  factura: "INVOICE",
  invoice: "INVOICE",
  "01": "INVOICE",
  "nota credito": "CREDIT_NOTE",
  "nota de credito": "CREDIT_NOTE",
  "nota de crédito": "CREDIT_NOTE",
  credit_note: "CREDIT_NOTE",
  "04": "CREDIT_NOTE",
  "nota debito": "DEBIT_NOTE",
  "nota de debito": "DEBIT_NOTE",
  "nota de débito": "DEBIT_NOTE",
  debit_note: "DEBIT_NOTE",
  "05": "DEBIT_NOTE",
};

export function normalizeDocumentType(raw: string): string {
  if (!raw || !raw.trim()) return "INVOICE";
  const key = raw.trim().toLowerCase().replace(/[áàä]/g, "a").replace(/[éèë]/g, "e");
  return DOC_TYPE_MAP[key] ?? "INVOICE";
}

// ── Identification Type Normalizer ──────────────────────────────────────────

const ID_TYPE_MAP: Record<string, string> = {
  cedula: "CEDULA",
  cédula: "CEDULA",
  "04": "CEDULA",
  ruc: "RUC",
  "05": "RUC",
  pasaporte: "PASAPORTE",
  "06": "PASAPORTE",
  exterior: "FOREIGN_ID",
  foreign_id: "FOREIGN_ID",
  "08": "FOREIGN_ID",
  consumidor_final: "CONSUMIDOR_FINAL",
  "07": "CONSUMIDOR_FINAL",
};

export function normalizeIdentificationType(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[éèë]/g, "e");
  return ID_TYPE_MAP[key] ?? "CEDULA";
}

// ── Tax Type Normalizer ─────────────────────────────────────────────────────

export function parseTaxRate(raw: string): { taxRate: number; taxCategory: string | null } {
  const str = raw.trim().toLowerCase().replace("%", "");

  if (str === "no objeto" || str === "no_objeto") {
    return { taxRate: 0, taxCategory: "NO_OBJETO_DE_IMPUESTO" };
  }
  if (str === "exento" || str === "exento iva") {
    return { taxRate: 0, taxCategory: "EXENTO_DE_IVA" };
  }

  const rate = Number(str);
  if (Number.isFinite(rate) && rate >= 0) {
    if (rate === 0) return { taxRate: 0, taxCategory: "IVA_0" };
    return { taxRate: rate, taxCategory: `IVA_${rate}` };
  }

  return { taxRate: 0, taxCategory: null };
}
