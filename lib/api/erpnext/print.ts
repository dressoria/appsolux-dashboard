import "@/lib/security/server-only";
import { getErpnextConfig } from "./client";

export const ALLOWED_PRINT_DOCTYPES = [
  "Sales Invoice",
  "Sales Order",
  "Payment Entry",
  "Purchase Order",
  "Purchase Invoice",
  "Purchase Receipt",
] as const;

export type ErpnextPrintDoctype = (typeof ALLOWED_PRINT_DOCTYPES)[number];

const ALLOWED_DOCTYPES = new Set<string>(ALLOWED_PRINT_DOCTYPES);

export function isAllowedDoctype(doctype: string): boolean {
  return ALLOWED_DOCTYPES.has(doctype);
}

export function assertErpnextPrintRequest(
  doctype: string,
  name: string
): asserts doctype is ErpnextPrintDoctype {
  if (!isAllowedDoctype(doctype)) {
    throw new Error(`Tipo de documento no permitido: ${doctype}`);
  }

  if (!name.trim()) {
    throw new Error("Nombre de documento requerido.");
  }
}

export function buildErpnextPrintUrl(
  doctype: ErpnextPrintDoctype,
  name: string,
  options?: {
    format?: string;
    noLetterhead?: boolean;
    letterhead?: string;
  }
): string {
  assertErpnextPrintRequest(doctype, name);

  const { baseUrl } = getErpnextConfig();
  const params = new URLSearchParams({
    doctype,
    name,
    format: options?.format ?? "Standard",
    no_letterhead: options?.noLetterhead ? "1" : "0",
  });

  if (options?.letterhead) {
    params.set("letterhead", options.letterhead);
  }

  return `${baseUrl}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`;
}

export async function getErpnextPrintPdf(
  doctype: string,
  name: string
): Promise<Response> {
  assertErpnextPrintRequest(doctype, name);

  const { apiKey, apiSecret } = getErpnextConfig();

  return fetch(buildErpnextPrintUrl(doctype, name), {
    headers: {
      Authorization: `token ${apiKey}:${apiSecret}`,
    },
    cache: "no-store",
  });
}
