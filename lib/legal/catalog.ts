export const legalDocuments = [
  { type: "terms", slug: "terminos-y-condiciones", title: "Términos y Condiciones", action: "ACCEPTED" },
  { type: "privacy", slug: "politica-de-privacidad", title: "Política de Privacidad", action: "ACKNOWLEDGED" },
  { type: "payments", slug: "pagos-y-suscripciones", title: "Condiciones de Pagos y Suscripciones", action: "ACCEPTED" },
  { type: "dpa", slug: "acuerdo-tratamiento-datos", title: "Acuerdo de Tratamiento de Datos", action: "ACCEPTED" },
  { type: "cookies", slug: "politica-de-cookies", title: "Política de Cookies", action: "ACKNOWLEDGED" },
] as const;

export type LegalProof = { accepted: boolean; authorizedRepresentative: boolean; releaseId: string; releaseHash: string };
export type LegalBundleSummary = { id: string; hash: string; version: string; documents: Array<{ type: string; title: string; url: string; hash: string; version: string }> };

export function proofFromForm(form: FormData): LegalProof {
  return {
    accepted: form.get("legalAccepted") === "on",
    authorizedRepresentative: form.get("legalAuthorized") === "on",
    releaseId: String(form.get("legalReleaseId") ?? ""),
    releaseHash: String(form.get("legalReleaseHash") ?? ""),
  };
}
