import { buildAtsPeriodData } from "./ats-data";
import type { TaxSnapshot } from "./types";

export function buildSriTaxSummary(snapshot: TaxSnapshot) {
  const ats = buildAtsPeriodData(snapshot);
  const purchases = snapshot.documents.filter(
    (d) => d.direction === "PURCHASE",
  );
  const pending =
    snapshot.inbox.filter(
      (i) =>
        !i.purchaseDocumentId && !["REGISTERED", "IGNORED"].includes(i.status),
    ).length +
    purchases.filter((d) => ["DRAFT", "NEEDS_REVIEW"].includes(d.status))
      .length;
  return {
    company: ats.company,
    period: ats.period,
    sales: ats.totals.sales,
    purchases: ats.totals.purchases,
    issuedWithholdings: ats.totals.withholdings.amount,
    receivedWithholdings: null,
    problems: new Set(
      ats.issues
        .filter((i) => i.severity === "ERROR" && i.document)
        .map((i) => i.href ?? `${i.type}:${i.document}`),
    ).size,
    atsStatus: !ats.hasInformation
      ? "Sin información"
      : ats.issues.some((i) => i.severity !== "INFO")
        ? "Con observaciones"
        : "Listo",
    ivaStatus: "Por revisar",
    received: {
      registered:
        purchases.filter((d) => ["REGISTERED", "AUTHORIZED"].includes(d.status))
          .length +
        snapshot.inbox.filter(
          (i) => !i.purchaseDocumentId && i.status === "REGISTERED",
        ).length,
      pending,
    },
    coverage:
      "Totales de documentos registrados; no acreditan integridad frente al SRI. IVA compras es crédito potencial sujeto a clasificación.",
  };
}
