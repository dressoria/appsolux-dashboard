import "@/lib/security/server-only";

import type { LightweightCustomerIdentificationType } from "@prisma/client";

import {
  normalizeIdentification,
  validateIdentification,
} from "@/lib/core/identification-rules";

export type CustomerFiscalData = {
  name: string;
  identificationType: LightweightCustomerIdentificationType | null;
  identification: string | null;
};

export function normalizeCustomerIdentification(
  type: LightweightCustomerIdentificationType,
  value: string
) {
  return normalizeIdentification(type, value);
}

export function validateCustomerIdentification(
  type: LightweightCustomerIdentificationType,
  value: string
) {
  return validateIdentification(type, value);
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
