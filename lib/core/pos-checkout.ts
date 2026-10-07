export type PosOutputMode = "internal_receipt" | "sri_invoice";

export function defaultSriPaymentCode(method: string) {
  if (method === "cash") return "01";
  if (method === "card") return "19";
  return "20";
}

export function fiscalSelection(
  mode: PosOutputMode,
  establishmentId: string,
  issuePointId: string,
) {
  return mode === "sri_invoice"
    ? {
        establishmentId: establishmentId || undefined,
        issuePointId: issuePointId || undefined,
      }
    : { establishmentId: undefined, issuePointId: undefined };
}
