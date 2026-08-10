import "@/lib/security/server-only";

import type { LightweightCustomerIdentificationType } from "@prisma/client";

import {
  isValidEcuadorCedula,
  normalizeEcuadorIdentification,
} from "@/lib/onboarding/ecuador-identification";

export type CustomerFiscalData = {
  name: string;
  identificationType: LightweightCustomerIdentificationType | null;
  identification: string | null;
};

function validateSpecialRuc(digits: string) {
  const third = Number(digits[2]);
  const modulus = 11;

  if (third === 9) {
    const weights = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const verifier = modulus - (sum % modulus);
    return (verifier === 11 ? 0 : verifier) === Number(digits[9]);
  }

  if (third === 6) {
    const weights = [3, 2, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const verifier = modulus - (sum % modulus);
    return (verifier === 11 ? 0 : verifier) === Number(digits[8]);
  }

  return false;
}

export function isValidEcuadorRuc(value: string) {
  const digits = normalizeEcuadorIdentification(value);
  if (!/^\d{13}$/.test(digits) || digits.endsWith("000")) return false;
  const third = Number(digits[2]);
  if (third <= 5) return isValidEcuadorCedula(digits.slice(0, 10));
  return validateSpecialRuc(digits);
}

export function normalizeCustomerIdentification(
  type: LightweightCustomerIdentificationType,
  value: string
) {
  return type === "RUC" || type === "CEDULA"
    ? normalizeEcuadorIdentification(value)
    : value.trim().toUpperCase();
}

export function validateCustomerIdentification(
  type: LightweightCustomerIdentificationType,
  value: string
) {
  const normalized = normalizeCustomerIdentification(type, value);
  if (type === "RUC" && !isValidEcuadorRuc(normalized)) {
    throw new Error("Ingresa un RUC ecuatoriano valido de 13 digitos.");
  }
  if (type === "CEDULA" && !isValidEcuadorCedula(normalized)) {
    throw new Error("Ingresa una cedula ecuatoriana valida de 10 digitos.");
  }
  if ((type === "PASSPORT" || type === "FOREIGN_ID") && !/^[A-Z0-9][A-Z0-9 .\/-]{2,29}$/.test(normalized)) {
    throw new Error("La identificacion debe tener entre 3 y 30 caracteres validos.");
  }
  return normalized;
}

export function validateCustomerForSriInvoice(customer: CustomerFiscalData | null) {
  if (!customer) {
    return {
      name: "Consumidor Final",
      identificationType: null,
      identification: "9999999999999",
    };
  }
  if (!customer.name.trim() || !customer.identificationType || !customer.identification) {
    throw new Error("Completa los datos fiscales del cliente antes de emitir la factura.");
  }
  return {
    name: customer.name.trim(),
    identificationType: customer.identificationType,
    identification: validateCustomerIdentification(customer.identificationType, customer.identification),
  };
}

export function mapCustomerIdentificationTypeToSri(
  type: LightweightCustomerIdentificationType | null
) {
  if (type === "RUC") return "04";
  if (type === "CEDULA") return "05";
  if (type === "PASSPORT") return "06";
  if (type === "FOREIGN_ID") return "08";
  return "07";
}
