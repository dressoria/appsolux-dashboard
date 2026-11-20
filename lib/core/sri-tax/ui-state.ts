import type { AtsPeriodData } from "./ats-data";
import type { TaxIssue } from "./types";

export function taxIssueGroups(issues: TaxIssue[]) {
  return {
    errors: issues.filter((issue) => issue.severity === "ERROR"),
    warnings: issues.filter((issue) => issue.severity === "WARNING"),
    information: issues.filter((issue) => issue.severity === "INFO"),
  };
}

export function atsPreparationState(data: AtsPeriodData) {
  const groups = taxIssueGroups(data.issues);
  const canDownloadXml = !groups.errors.length && data.domainStatus === "DOMAIN_VALIDATION_OK" && data.xmlStatus === "XML_GENERATED" && data.xsdStatus === "XSD_VALIDATED";
  return {
    ...groups,
    canDownloadXml,
    title: groups.errors.length || data.domainStatus !== "DOMAIN_VALIDATION_OK"
      ? "Errores que bloquean el anexo"
      : data.xsdStatus === "XSD_VALIDATION_ERROR" ? "Error de validación XSD"
      : data.xsdStatus !== "XSD_VALIDATED" || data.xmlStatus !== "XML_GENERATED" ? "Preparación pendiente de validación"
      : groups.warnings.length ? "Preparación con advertencias" : "Preparación correcta",
    nextAction: groups.errors[0]?.action ?? (data.xsdStatus !== "XSD_VALIDATED" ? "Complete la validación XSD en el servidor antes de descargar el XML." : groups.warnings[0]?.action ?? "Revise la información del período antes de utilizar el archivo."),
  };
}
