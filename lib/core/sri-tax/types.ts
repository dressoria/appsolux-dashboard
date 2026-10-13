import type { TaxPeriod } from "./tax-period";
import { decimal, money } from "./money";

export type TaxLine = { base: string; rate: string; iva: string };
export type TaxDocument = {
  id: string;
  tenantId: string;
  direction: "SALE" | "PURCHASE";
  type: string;
  status: string;
  environment: string | null;
  number: string | null;
  identification: string | null;
  identificationType: string | null;
  name: string | null;
  date: string | null;
  accessKey: string | null;
  authorization: string | null;
  establishment: string | null;
  issuePoint: string | null;
  base: string;
  iva: string;
  total: string;
  lines: TaxLine[];
  category: string | null;
  deductibility: string | null;
  // These classifications are intentionally not inferred from rates or category names.
  fiscalClassification: string | null;
  relatedDocument: string | null;
  withholding: {
    type: string;
    code: string;
    base: string;
    rate: string;
    amount: string;
    purchaseNumber: string | null;
    catalogValid: boolean;
  }[];
  href: string;
};
export type TaxInbox = {
  id: string;
  tenantId: string;
  purchaseDocumentId: string | null;
  status: string;
  type: string | null;
  number: string | null;
  name: string | null;
  identification: string | null;
  accessKey: string | null;
  date: string | null;
  base: string;
  iva: string;
  total: string;
  origin: string;
  hasXml: boolean;
};
export type TaxSnapshot = {
  tenantId: string;
  period: TaxPeriod;
  profile: { ruc: string; legalName: string; regime: string | null } | null;
  documents: TaxDocument[];
  inbox: TaxInbox[];
  undatedCount: number;
};
export type TaxIssue = {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  type: string;
  document: string | null;
  description: string;
  action: string;
  href: string | null;
};

export function isDefinitive(document: TaxDocument) {
  return document.direction === "SALE"
    ? document.status === "AUTHORIZED" && document.environment === "PRODUCTION"
    : document.status === "AUTHORIZED" || document.status === "REGISTERED";
}
export function signedAmount(
  document: TaxDocument,
  field: "base" | "iva" | "total",
) {
  return money(
    decimal(document[field]).mul(document.type === "CREDIT_NOTE" ? -1 : 1),
  );
}
