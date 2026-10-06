import "@/lib/security/server-only";

import { validateCustomerIdentification } from "@/lib/core/customer-fiscal";

export type SriTaxpayerLookupResult =
  | { found: false }
  | {
      found: true;
      source: "SRI_PUBLIC" | "OPEN_DATA" | "CACHE";
      identification: string;
      legalName: string;
      tradeName?: string;
      taxpayerStatus?: string;
      taxpayerType?: string;
      province?: string;
      city?: string;
      economicActivity?: string;
      queriedAt: string;
    };

export interface SriTaxpayerProvider {
  lookup(identification: string): Promise<SriTaxpayerLookupResult>;
}

class ConfiguredOpenDataProvider implements SriTaxpayerProvider {
  async lookup(identification: string): Promise<SriTaxpayerLookupResult> {
    const endpoint = process.env.SRI_TAXPAYER_LOOKUP_URL?.trim();
    if (!endpoint) return { found: false };
    const url = new URL(endpoint);
    url.searchParams.set("identification", identification);
    const response = await fetch(url, {
      headers: process.env.SRI_TAXPAYER_LOOKUP_TOKEN
        ? { Authorization: `Bearer ${process.env.SRI_TAXPAYER_LOOKUP_TOKEN}` }
        : undefined,
      cache: "no-store",
    });
    if (response.status === 404) return { found: false };
    if (!response.ok) throw new Error("La consulta pública no está disponible temporalmente.");
    const data = (await response.json()) as Record<string, unknown>;
    if (data.found === false || typeof data.legalName !== "string") return { found: false };
    return {
      found: true,
      source: data.source === "SRI_PUBLIC" ? "SRI_PUBLIC" : "OPEN_DATA",
      identification,
      legalName: data.legalName,
      tradeName: typeof data.tradeName === "string" ? data.tradeName : undefined,
      taxpayerStatus: typeof data.taxpayerStatus === "string" ? data.taxpayerStatus : undefined,
      taxpayerType: typeof data.taxpayerType === "string" ? data.taxpayerType : undefined,
      province: typeof data.province === "string" ? data.province : undefined,
      city: typeof data.city === "string" ? data.city : undefined,
      economicActivity: typeof data.economicActivity === "string" ? data.economicActivity : undefined,
      queriedAt: new Date().toISOString(),
    };
  }
}

export async function lookupSriTaxpayer(rawIdentification: string, provider: SriTaxpayerProvider = new ConfiguredOpenDataProvider()) {
  const digits = rawIdentification.replace(/\D/g, "");
  const type = digits.length === 13 ? "RUC" : "CEDULA";
  const identification = validateCustomerIdentification(type, digits);
  return provider.lookup(identification);
}
