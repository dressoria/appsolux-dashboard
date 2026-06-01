import "@/lib/security/server-only";
import { createHash } from "crypto";

export type SriAccessKeyParams = {
  issuedAt: Date;
  documentType: string;
  ruc: string;
  environment: "TEST" | "PRODUCTION";
  establishmentCode: string;
  issuePointCode: string;
  sequentialNumber: number;
  numericCode: string;
  emissionType?: string;
};

export type SriAccessKeyResult = {
  accessKey: string;
  base48: string;
  checkDigit: string;
  documentCode: string;
  environmentCode: string;
  sequential: string;
  displayNumber: string;
  numericCode: string;
};

export function formatSriDateForAccessKey(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}${month}${year}`;
}

export function getSriDocumentCode(documentType: string): string {
  const codes: Record<string, string> = {
    INVOICE: "01",
    CREDIT_NOTE: "04",
    DEBIT_NOTE: "05",
    WITHHOLDING: "07",
    REFERRAL_GUIDE: "06",
  };
  const code = codes[documentType];
  if (!code) throw new Error(`Tipo de documento SRI no soportado: ${documentType}`);
  return code;
}

export function getSriEnvironmentCode(environment: "TEST" | "PRODUCTION"): string {
  return environment === "PRODUCTION" ? "2" : "1";
}

export function formatSriSequential(sequential: number): string {
  return String(sequential).padStart(9, "0");
}

export function buildSriDisplayNumber(
  establishmentCode: string,
  issuePointCode: string,
  sequential: number
): string {
  return `${establishmentCode}-${issuePointCode}-${formatSriSequential(sequential)}`;
}

// Algoritmo módulo 11 del SRI Ecuador. Multiplicadores 2–7 de derecha a izquierda, cíclicos.
export function calculateModulo11CheckDigit(base48: string): string {
  if (base48.length !== 48) {
    throw new Error(
      `La base de la clave de acceso debe tener 48 dígitos. Recibido: ${base48.length}`
    );
  }
  const multipliers = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = base48.length - 1; i >= 0; i--) {
    const digit = parseInt(base48[i], 10);
    const multiplier = multipliers[(base48.length - 1 - i) % 6];
    sum += digit * multiplier;
  }
  const raw = 11 - (sum % 11);
  if (raw === 11) return "0";
  if (raw === 10) return "1";
  return String(raw);
}

// Código numérico de 8 dígitos, determinístico por documentId (evitar Math.random).
export function createStableNumericCode(documentId: string): string {
  const hash = createHash("sha256").update(documentId).digest("hex");
  const num = parseInt(hash.slice(0, 8), 16); // 32-bit, dentro de Number.MAX_SAFE_INTEGER
  return String(num % 100_000_000).padStart(8, "0");
}

export function buildSriAccessKey(params: SriAccessKeyParams): SriAccessKeyResult {
  const {
    issuedAt,
    documentType,
    ruc,
    environment,
    establishmentCode,
    issuePointCode,
    sequentialNumber,
    numericCode,
    emissionType = "1",
  } = params;

  if (!/^\d{13}$/.test(ruc)) throw new Error("RUC debe tener 13 dígitos.");
  if (!/^\d{3}$/.test(establishmentCode))
    throw new Error("Código de establecimiento debe tener 3 dígitos.");
  if (!/^\d{3}$/.test(issuePointCode))
    throw new Error("Código de punto de emisión debe tener 3 dígitos.");
  if (!/^\d{8}$/.test(numericCode))
    throw new Error("Código numérico debe tener 8 dígitos.");
  if (emissionType !== "1") throw new Error("Tipo de emisión debe ser '1' (normal).");

  const dateStr = formatSriDateForAccessKey(issuedAt);
  const docCode = getSriDocumentCode(documentType);
  const envCode = getSriEnvironmentCode(environment);
  const sequential = formatSriSequential(sequentialNumber);
  const displayNumber = buildSriDisplayNumber(establishmentCode, issuePointCode, sequentialNumber);

  // ddMMyyyy(8) + codDoc(2) + ruc(13) + ambiente(1) + estab(3) + ptoEmi(3) + secuencial(9) + codigoNumerico(8) + tipoEmision(1) = 48
  const base48 = `${dateStr}${docCode}${ruc}${envCode}${establishmentCode}${issuePointCode}${sequential}${numericCode}${emissionType}`;

  if (base48.length !== 48) {
    throw new Error(
      `Base de clave de acceso inválida: longitud ${base48.length}, esperado 48. Base: ${base48}`
    );
  }

  const checkDigit = calculateModulo11CheckDigit(base48);
  const accessKey = `${base48}${checkDigit}`;

  if (accessKey.length !== 49) {
    throw new Error(`Clave de acceso inválida: longitud ${accessKey.length}, esperado 49.`);
  }

  return {
    accessKey,
    base48,
    checkDigit,
    documentCode: docCode,
    environmentCode: envCode,
    sequential,
    displayNumber,
    numericCode,
  };
}
