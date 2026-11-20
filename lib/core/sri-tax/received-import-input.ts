import { parsePurchaseXml } from "@/lib/core/purchase-xml-import";
import { isValidEcuadorRuc } from "@/lib/core/ecuador-tax-id";
import { calculateModulo11CheckDigit, getSriDocumentCode, accessKeyMatchesEcuadorIssueDate } from "@/lib/core/sri-access-key";
import { parseSoapResponse } from "@/lib/core/sri-soap-client";

/** Input checks only. This does not establish SRI authorization or replace XML/XSD validation. */
export function receivedXmlInputError(xml: unknown, tenantRuc: string | null | undefined): string | null {
  if (typeof xml !== "string" || !xml.trim()) return "XML requerido.";
  if (Buffer.byteLength(xml, "utf8") > 4 * 1024 * 1024) return "El XML no puede superar 4 MB.";
  if (!tenantRuc || !isValidEcuadorRuc(tenantRuc)) return "Completa y verifica el RUC de la empresa activa antes de importar.";
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return "El XML no puede contener declaraciones DTD ni entidades externas.";
  const parsed = parsePurchaseXml(xml);
  if (!parsed.buyerIdentification || parsed.buyerIdentification !== tenantRuc) return "El receptor del XML debe coincidir con el RUC de la empresa activa.";
  if (!parsed.rucEmitter || !isValidEcuadorRuc(parsed.rucEmitter)) return "La identificación del emisor no es válida.";
  if (!parsed.documentType) return "El tipo de comprobante no está soportado por el importador existente.";
  const key = parsed.accessKey;
  if (!key || !/^\d{49}$/.test(key) || calculateModulo11CheckDigit(key.slice(0, 48)) !== key[48]) return "La clave de acceso no es válida.";
  if (/<(?:\w+:)?autorizacion(?:\s[^>]*)?>/.test(xml)) {
    const declared = parseSoapResponse(xml);
    if (!declared.authorized || declared.authorizationNumber !== key) return "La autorización declarada en el archivo es inválida o no corresponde a la clave de acceso.";
  }
  if (key.slice(10, 23) !== parsed.rucEmitter) return "El emisor no coincide con la clave de acceso.";
  if (key.slice(8, 10) !== getSriDocumentCode(parsed.documentType)) return "El tipo de comprobante no coincide con la clave de acceso.";
  if (!parsed.documentNumber || !/^\d{3}-\d{3}-\d{9}$/.test(parsed.documentNumber) || !parsed.issueDate || !parsed.legalName) return "El XML está incompleto: revisa número, fecha y razón social del emisor.";
  if (key.slice(24, 39) !== parsed.documentNumber.replaceAll("-", "")) return "El número de comprobante no coincide con la clave de acceso.";
  const dateParts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(parsed.issueDate);
  if (!dateParts) return "La fecha de emisión no es válida.";
  const date = new Date(`${dateParts[3]}-${dateParts[2]}-${dateParts[1]}T00:00:00-05:00`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}` || !accessKeyMatchesEcuadorIssueDate(key, date)) return "La fecha de emisión no es válida o no coincide con la clave de acceso.";
  if (![parsed.total, parsed.ivaTotal, parsed.discountTotal].every((value) => Number.isFinite(value) && value >= 0)) return "El XML contiene importes inválidos.";
  return null;
}
