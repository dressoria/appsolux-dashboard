import type { LightweightCustomerIdentificationType } from "@prisma/client";
import {
  isValidEcuadorCedula,
  isValidEcuadorRuc,
  normalizeEcuadorIdentification,
} from "@/lib/core/ecuador-tax-id";

const PASSPORT_PATTERN = /^[A-Z0-9][A-Z0-9 .\/\-]{1,18}[A-Z0-9]$/;
const FOREIGN_ID_PATTERN = /^[A-Z0-9][A-Z0-9 .\/\-]{1,28}[A-Z0-9]$/;

export function normalizeIdentification(
  type: LightweightCustomerIdentificationType,
  value: string,
): string {
  if (type === "RUC" || type === "CEDULA") {
    return normalizeEcuadorIdentification(value);
  }
  return value.trim().toUpperCase();
}

export function validateIdentification(
  type: LightweightCustomerIdentificationType,
  value: string,
): string {
  const normalized = normalizeIdentification(type, value);

  if (type === "RUC") {
    if (!isValidEcuadorRuc(normalized))
      throw new Error("Ingresa un RUC ecuatoriano válido de 13 dígitos.");
    return normalized;
  }
  if (type === "CEDULA") {
    if (!isValidEcuadorCedula(normalized))
      throw new Error("Ingresa una cédula ecuatoriana válida de 10 dígitos.");
    return normalized;
  }
  if (type === "PASSPORT") {
    if (normalized.length < 3 || normalized.length > 20)
      throw new Error("El pasaporte debe tener entre 3 y 20 caracteres.");
    if (!PASSPORT_PATTERN.test(normalized))
      throw new Error("El pasaporte contiene caracteres no válidos.");
    return normalized;
  }
  if (type === "FOREIGN_ID") {
    if (normalized.length < 3 || normalized.length > 30)
      throw new Error("La identificación exterior debe tener entre 3 y 30 caracteres.");
    if (!FOREIGN_ID_PATTERN.test(normalized))
      throw new Error("La identificación exterior contiene caracteres no válidos.");
    return normalized;
  }
  throw new Error("Tipo de identificación no reconocido.");
}

export function getIdentificationMaxLength(
  type: LightweightCustomerIdentificationType | null,
): number {
  if (type === "RUC") return 13;
  if (type === "CEDULA") return 10;
  if (type === "PASSPORT") return 20;
  if (type === "FOREIGN_ID") return 30;
  return 30;
}

export function getIdentificationInputMode(
  type: LightweightCustomerIdentificationType | null,
): "numeric" | "text" {
  if (type === "RUC" || type === "CEDULA") return "numeric";
  return "text";
}

export function isForeignIdentificationType(
  type: LightweightCustomerIdentificationType | null,
): boolean {
  return type === "PASSPORT" || type === "FOREIGN_ID";
}
