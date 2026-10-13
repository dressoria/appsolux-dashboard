import {
  isDefinitive,
  signedAmount,
  type TaxSnapshot,
  type TaxDocument,
} from "./types";
import { money, sum } from "./money";
import { validateTaxSnapshot } from "./tax-validations";

export function documentTotals(documents: TaxDocument[]) {
  return {
    count: documents.length,
    base: money(sum(documents.map((d) => signedAmount(d, "base")))),
    iva: money(sum(documents.map((d) => signedAmount(d, "iva")))),
    total: money(sum(documents.map((d) => signedAmount(d, "total")))),
  };
}

// This is the only dataset consumed by ATS preview, XML, summary and validation.
// No ATS catalog codes are inferred from invoice codes or accounting categories.
export function buildAtsPeriodData(snapshot: TaxSnapshot) {
  const issues = validateTaxSnapshot(snapshot);
  const definitive = snapshot.documents.filter(isDefinitive);
  const sales = definitive.filter(
    (d) =>
      d.direction === "SALE" &&
      ["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"].includes(d.type),
  );
  const purchases = definitive.filter((d) => d.direction === "PURCHASE");
  const withholdings = definitive.filter(
    (d) => d.direction === "SALE" && d.type === "WITHHOLDING",
  );
  const cancelled = snapshot.documents.filter((d) => d.status === "CANCELLED");
  const hasInformation =
    sales.length + purchases.length + withholdings.length + cancelled.length >
    0;
  const catalogMappingStatus = hasInformation
    ? "ATS_CATALOG_MAPPING_PENDING"
    : "NO_TRANSACTIONS";
  if (hasInformation)
    issues.push({
      code: "ATS_CATALOG_MAPPING_PENDING",
      severity: "ERROR",
      type: "ATS",
      document: null,
      description:
        "Pendiente de verificar el catálogo ATS vigente y completar sustentos, partes relacionadas, retenciones y documentos modificados. La descarga XML está bloqueada para evitar un anexo incompleto.",
      action: "Complete y verifique el mapeo tributario antes de exportar.",
      href: null,
    });
  if (!hasInformation)
    issues.push({
      code: "ATS_NO_INFORMATION",
      severity: "WARNING",
      type: "ATS",
      document: null,
      description:
        "Sin transacciones definitivas registradas para este período.",
      action: "Revise la integridad de la información del período.",
      href: null,
    });
  return {
    period: snapshot.period,
    company: snapshot.profile,
    sales,
    purchases,
    withholdings,
    cancelled,
    totals: {
      sales: documentTotals(sales),
      purchases: documentTotals(purchases),
      withholdings: {
        count: withholdings.length,
        amount: withholdings.some((d) => !d.withholding.length)
          ? null
          : money(
              sum(
                withholdings.flatMap((d) => d.withholding.map((l) => l.amount)),
              ),
            ),
      },
      cancelled: { count: cancelled.length },
    },
    issues,
    hasInformation,
    catalogMappingStatus,
    domainStatus: issues.some((i) => i.severity === "ERROR")
      ? "DOMAIN_VALIDATION_ERROR"
      : "DOMAIN_VALIDATION_OK",
    xmlStatus: "XML_NOT_GENERATED" as string,
    xsdStatus: "XSD_VALIDATION_PENDING" as string,
  };
}
export type AtsPeriodData = ReturnType<typeof buildAtsPeriodData>;
