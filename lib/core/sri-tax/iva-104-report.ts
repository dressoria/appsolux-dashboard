import { IVA_CLASSIFICATIONS, type IvaClassification } from "./iva-104-catalog";
import { decimal, money, sum } from "./money";
import { documentTotals } from "./ats-data";
import { assertTaxScope, validateTaxSnapshot } from "./tax-validations";
import { TaxInputError } from "./tax-period";
import { isDefinitive, signedAmount, type TaxSnapshot } from "./types";

export type IvaManualInputs = {
  previousPurchasesCredit?: string;
  previousWithholdingsCredit?: string;
  applicablePurchasesCredit?: string;
  classifications?: Record<string, IvaClassification>;
};

export function parseIvaManualInputs(value: unknown): IvaManualInputs {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TaxInputError("Datos manuales inválidos.");
  const input = value as Record<string, unknown>;
  const result: IvaManualInputs = {};
  for (const key of [
    "previousPurchasesCredit",
    "previousWithholdingsCredit",
    "applicablePurchasesCredit",
  ] as const) {
    const raw = input[key];
    if (raw === undefined || raw === "") continue;
    if (typeof raw !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(raw))
      throw new TaxInputError(`Valor manual inválido: ${key}.`);
    result[key] = money(raw);
  }
  if (input.classifications !== undefined) {
    if (
      !input.classifications ||
      typeof input.classifications !== "object" ||
      Array.isArray(input.classifications) ||
      Object.keys(input.classifications).length > 5000
    )
      throw new TaxInputError("Clasificaciones inválidas.");
    result.classifications = {};
    for (const [id, code] of Object.entries(input.classifications)) {
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
        typeof code !== "string" ||
        !Object.hasOwn(IVA_CLASSIFICATIONS, code)
      )
        throw new TaxInputError("Clasificación fiscal inválida.");
      result.classifications[id] = code as IvaClassification;
    }
  }
  return result;
}

export function buildIva104Report(
  snapshot: TaxSnapshot,
  inputs: IvaManualInputs = {},
) {
  assertTaxScope(snapshot);
  const manual = parseIvaManualInputs(inputs);
  const transactions = snapshot.documents.filter(
    (d) =>
      isDefinitive(d) &&
      [
        "INVOICE",
        "CREDIT_NOTE",
        "DEBIT_NOTE",
        "PURCHASE_SETTLEMENT",
        "OTHER",
      ].includes(d.type),
  );
  const ids = new Set(transactions.map((d) => d.id));
  for (const id of Object.keys(manual.classifications ?? {}))
    if (!ids.has(id))
      throw new TaxInputError(
        "La clasificación no pertenece a un documento definitivo de este período.",
      );
  const unclassifiedDocuments = transactions.filter(
    (d) => !manual.classifications?.[d.id] && !d.fiscalClassification,
  );
  const rows = Object.entries(IVA_CLASSIFICATIONS).map(([key, definition]) => {
    const docs = transactions.filter(
      (d) => (manual.classifications?.[d.id] ?? d.fiscalClassification) === key,
    );
    for (const d of docs) {
      if (d.direction !== definition.direction)
        throw new TaxInputError(
          "Clasificación incompatible con el tipo de operación.",
        );
      if (
        !d.lines.length ||
        d.lines.some((l) =>
          definition.tax === "ZERO"
            ? !decimal(l.rate).isZero() || !decimal(l.iva).isZero()
            : !decimal(l.rate).gt(0),
        )
      )
        throw new TaxInputError(
          "La clasificación no corresponde a las tasas del detalle. Las operaciones mixtas requieren clasificación por línea.",
        );
      // Reduced and differentiated rates need their own legal classification.
      if (
        definition.tax === "POSITIVE" &&
        d.lines.some(
          (l) => !["12", "14", "15"].some((r) => decimal(l.rate).eq(r)),
        )
      )
        throw new TaxInputError(
          "Tarifa diferenciada pendiente de clasificación específica.",
        );
    }
    const complete = !unclassifiedDocuments.some(
      (d) => d.direction === definition.direction,
    );
    const classified = {
      gross: money(
        sum(docs.filter((d) => d.type !== "CREDIT_NOTE").map((d) => d.base)),
      ),
      net: money(sum(docs.map((d) => signedAmount(d, "base")))),
      iva: money(sum(docs.map((d) => signedAmount(d, "iva")))),
    };
    return {
      key,
      ...definition,
      count: docs.length,
      complete,
      classified,
      gross: complete ? classified.gross : null,
      net: complete ? classified.net : null,
      iva: complete ? classified.iva : null,
      manual: docs.some((d) => !!manual.classifications?.[d.id]),
    };
  });
  const unclassified = unclassifiedDocuments.map((d) => ({
    id: d.id,
    number: d.number,
    direction: d.direction,
    type: d.type,
    base: signedAmount(d, "base"),
    iva: signedAmount(d, "iva"),
    href: d.href,
    rates: [...new Set(d.lines.map((l) => l.rate))],
  }));
  const sales = transactions.filter((d) => d.direction === "SALE");
  const purchases = transactions.filter((d) => d.direction === "PURCHASE");
  const generatedIva = money(sum(sales.map((d) => signedAmount(d, "iva"))));
  const potentialCredit = money(
    sum(rows.filter((r) => r.credit).map((r) => r.classified.iva)),
  );
  const applicableCredit = manual.applicablePurchasesCredit ?? null;
  if (
    applicableCredit !== null &&
    decimal(applicableCredit).gt(
      decimal(potentialCredit).greaterThan(0) ? potentialCredit : 0,
    )
  )
    throw new TaxInputError(
      "El crédito aplicable no puede superar el crédito potencial clasificado.",
    );
  const previousPurchasesCredit = manual.previousPurchasesCredit ?? null;
  const previousWithholdingsCredit = manual.previousWithholdingsCredit ?? null;
  const causedTax =
    applicableCredit === null
      ? null
      : money(
          decimal(generatedIva).minus(applicableCredit).greaterThan(0)
            ? decimal(generatedIva).minus(applicableCredit)
            : 0,
        );
  const availableCredit =
    applicableCredit === null || previousPurchasesCredit === null
      ? null
      : money(decimal(applicableCredit).plus(previousPurchasesCredit));
  const preliminarySubtotal =
    availableCredit === null || previousWithholdingsCredit === null
      ? null
      : money(
          decimal(generatedIva)
            .minus(availableCredit)
            .minus(previousWithholdingsCredit)
            .greaterThan(0)
            ? decimal(generatedIva)
                .minus(availableCredit)
                .minus(previousWithholdingsCredit)
            : 0,
        );
  const issues = validateTaxSnapshot({
    ...snapshot,
    documents: snapshot.documents.map((d) => ({
      ...d,
      fiscalClassification:
        manual.classifications?.[d.id] ?? d.fiscalClassification,
    })),
  });
  const pending = snapshot.inbox.filter(
    (i) => !["REGISTERED", "IGNORED"].includes(i.status),
  ).length;
  const factors = [
    {
      label: "Operaciones con clasificación fiscal",
      complete: unclassified.length === 0,
    },
    {
      label: "Comprobantes pendientes revisados",
      complete:
        pending === 0 &&
        !issues.some((i) => i.code === "DOCUMENT_PENDING") &&
        snapshot.undatedCount === 0,
    },
    {
      label: "Sin errores tributarios",
      complete: !issues.some((i) => i.severity === "ERROR"),
    },
    {
      label: "Saldos anteriores ingresados",
      complete:
        previousPurchasesCredit !== null && previousWithholdingsCredit !== null,
    },
    {
      label: "Crédito aplicable confirmado",
      complete: applicableCredit !== null,
    },
    { label: "Retenciones recibidas disponibles", complete: false },
    { label: "Información registrada", complete: transactions.length > 0 },
  ];
  return {
    company: snapshot.profile,
    period: snapshot.period,
    nature: "Reporte de apoyo para la declaración de IVA",
    estimated: true,
    rows,
    sales: documentTotals(sales),
    purchases: documentTotals(purchases),
    unclassified,
    issues,
    manual,
    rateGroups: ["SALE", "PURCHASE"].flatMap((direction) => {
      const groups = new Map<string, { base: string[]; iva: string[] }>();
      for (const d of transactions.filter((d) => d.direction === direction))
        for (const l of d.lines) {
          const rate = decimal(l.rate).toString();
          const group = groups.get(rate) ?? { base: [], iva: [] };
          group.base.push(
            money(decimal(l.base).mul(d.type === "CREDIT_NOTE" ? -1 : 1)),
          );
          group.iva.push(
            money(decimal(l.iva).mul(d.type === "CREDIT_NOTE" ? -1 : 1)),
          );
          groups.set(rate, group);
        }
      return [...groups].map(([rate, group]) => ({
        direction,
        rate,
        base: money(sum(group.base)),
        iva: money(sum(group.iva)),
      }));
    }),
    tax: {
      generatedIva,
      potentialCredit,
      applicableCredit,
      causedTax,
      previousPurchasesCredit,
      previousWithholdingsCredit,
      availableCredit,
      receivedWithholdings: null,
      preliminarySubtotal,
      subtotal: null,
      nextPeriodCredit: null,
      totalEstimated: null,
    },
    completeness: {
      percentage: Math.floor(
        (factors.filter((f) => f.complete).length * 100) / factors.length,
      ),
      factors,
    },
    observations: [
      "Pueden existir retenciones recibidas aún no registradas.",
      "Las clasificaciones y valores manuales viven solo en este formulario; se pierden al salir o cambiar el período.",
      "El crédito aplicable exige revisar el factor de proporcionalidad o la contabilidad; IVA compras no equivale automáticamente a crédito.",
      "Ajustes por notas de crédito de distinta tarifa, compensaciones, diferimiento e importaciones requieren revisión específica.",
      "Los totales registrados no acreditan que se hayan incorporado todos los comprobantes del SRI.",
    ],
    pendingBoxes: [
      "404/414",
      "406/416",
      "410/420/430",
      "425/435/445",
      "423",
      "424",
      "431/441",
      "499",
      "530/533/534",
      "540/550/560",
      "503/513/523",
      "504/514/524",
      "505/515/525",
      "506/516",
      "508/518",
      "526",
      "527",
      "615",
      "617",
      "620",
      "699",
    ],
  };
}
export type Iva104Report = ReturnType<typeof buildIva104Report>;
