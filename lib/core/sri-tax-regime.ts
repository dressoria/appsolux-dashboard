export type SriTaxRegimeCode =
  | "REGIMEN_GENERAL"
  | "RIMPE_EMPRENDEDOR"
  | "RIMPE_NEGOCIO_POPULAR"
  | "OTRO_OFICIAL";

export type ResolvedSriTaxRegime = {
  code: SriTaxRegimeCode;
  label: string;
  officialValue: string;
};

const comparable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

export function resolveSriTaxRegime(input: {
  taxRegime?: string | null;
  contribuyenteRimpe?: string | null;
}): ResolvedSriTaxRegime | null {
  const officialValue = input.contribuyenteRimpe?.trim() || input.taxRegime?.trim();
  if (!officialValue) return null;
  const value = comparable(officialValue);
  if (value.includes("NEGOCIO POPULAR")) {
    return {
      code: "RIMPE_NEGOCIO_POPULAR",
      label: "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
      officialValue,
    };
  }
  if (value.includes("RIMPE") && value.includes("EMPRENDEDOR")) {
    return {
      code: "RIMPE_EMPRENDEDOR",
      label: "CONTRIBUYENTE RÉGIMEN RIMPE",
      officialValue,
    };
  }
  if (value === "RIMPE" || value.includes("REGIMEN RIMPE")) {
    return {
      code: "RIMPE_EMPRENDEDOR",
      label: "CONTRIBUYENTE RÉGIMEN RIMPE",
      officialValue,
    };
  }
  if (value.includes("REGIMEN GENERAL") || value === "GENERAL") {
    return {
      code: "REGIMEN_GENERAL",
      label: "CONTRIBUYENTE RÉGIMEN GENERAL",
      officialValue,
    };
  }
  if (value.includes("REGIMEN") || value.includes("RÉGIMEN")) {
    return { code: "OTRO_OFICIAL", label: officialValue, officialValue };
  }
  return null;
}

export const UNKNOWN_SRI_TAX_REGIME_MESSAGE =
  "No pudimos determinar automáticamente el régimen tributario de esta empresa. Actualiza los datos SRI e intenta nuevamente.";

export function requireSriTaxRegime(input: Parameters<typeof resolveSriTaxRegime>[0]) {
  const resolved = resolveSriTaxRegime(input);
  if (!resolved) throw new Error(UNKNOWN_SRI_TAX_REGIME_MESSAGE);
  return resolved;
}
