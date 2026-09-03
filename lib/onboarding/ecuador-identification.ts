export type TaxIdentificationType = "ruc" | "cedula" | "none";

export {
  getEcuadorRucType,
  isValidEcuadorCedula,
  isValidEcuadorRuc,
  normalizeEcuadorIdentification,
} from "@/lib/core/ecuador-tax-id";
