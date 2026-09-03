import "@/lib/security/server-only";

import type { LightweightCustomerIdentificationType } from "@prisma/client";

import {
  isValidEcuadorCedula,
  isValidEcuadorRuc,
  normalizeEcuadorIdentification,
} from "@/lib/core/ecuador-tax-id";

export type CustomerFiscalData = {
  name: string;
  identificationType: LightweightCustomerIdentificationType | null;
  identification: string | null;
};

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
  if (type === "RUC" && !isValidEcuadorRuc(value)) {
    throw new Error("Ingresa un RUC ecuatoriano valido de 13 digitos.");
  }
  if (type === "CEDULA" && !isValidEcuadorCedula(value)) {
    throw new Error("Ingresa una cedula ecuatoriana valida de 10 digitos.");
  }
  const normalized = normalizeCustomerIdentification(type, value);
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
