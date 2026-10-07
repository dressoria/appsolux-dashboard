import { isValidEcuadorCedula, isValidEcuadorRuc } from "./ecuador-tax-id.ts";
import {
  ECUADOR_LOCATIONS,
  getEcuadorCantons,
  getEcuadorParishes,
} from "./ecuador-locations.ts";

export type SriTaxpayerLookupResult =
  | { found: false; identification: string; source?: string; queriedAt: string }
  | {
      found: true;
      source: string;
      identification: string;
      legalName?: string;
      tradeName?: string;
      address?: string;
      province?: string;
      city?: string;
      parish?: string;
      taxpayerStatus?: string;
      taxpayerClass?: string;
      taxpayerType?: string;
      taxRegime?: string;
      contribuyenteRimpe?: string;
      economicActivity?: string;
      ciiuCode?: string;
      accountingRequired?: boolean;
      specialTaxpayer?: boolean;
      withholdingAgent?: boolean;
      sourceUpdatedAt?: string;
      queriedAt: string;
    };

export interface SriTaxpayerProvider {
  lookup(identification: string): Promise<SriTaxpayerLookupResult>;
}

const text = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 500)
    : undefined;
const comparable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
const named = (value: string | undefined, options: readonly string[]) =>
  value
    ? (options.find((option) => comparable(option) === comparable(value)) ??
      title(value))
    : undefined;
const title = (value: string) =>
  value
    .toLocaleLowerCase("es")
    .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es"));

export function normalizeTaxpayerResponse(
  data: Record<string, unknown>,
  identification: string,
  source = "OPEN_DATA",
  queriedAt = new Date().toISOString(),
): SriTaxpayerLookupResult {
  if (data.found === false)
    return { found: false, identification, source, queriedAt };
  const legalName = text(data.legalName ?? data.razonSocial ?? data.nombre);
  if (!legalName) return { found: false, identification, source, queriedAt };
  const rawProvince = text(data.province ?? data.provincia);
  const province = named(
    rawProvince,
    ECUADOR_LOCATIONS.map((item) => item.name),
  );
  const rawCity = text(data.city ?? data.canton ?? data.ciudad);
  const city = named(
    rawCity,
    province ? getEcuadorCantons(province).map((item) => item.name) : [],
  );
  const rawParish = text(data.parish ?? data.parroquia);
  const parish = named(
    rawParish,
    province && city ? getEcuadorParishes(province, city) : [],
  );
  return {
    found: true,
    identification,
    source: text(data.source) ?? source,
    queriedAt,
    legalName,
    tradeName: text(data.tradeName ?? data.nombreComercial),
    address: text(data.address ?? data.direccion),
    province,
    city,
    parish,
    taxpayerStatus: text(
      data.taxpayerStatus ?? data.estadoContribuyente ?? data.estado,
    ),
    taxpayerClass: text(data.taxpayerClass ?? data.claseContribuyente),
    taxpayerType: text(
      data.taxpayerType ?? data.tipoContribuyente ?? data.tipo,
    ),
    taxRegime: text(data.taxRegime ?? data.regimenTributario ?? data.regimen),
    contribuyenteRimpe: text(
      data.contribuyenteRimpe ?? data.condicionRimpe ?? data.regimenRimpe,
    ),
    economicActivity: text(
      data.economicActivity ?? data.actividadEconomica ?? data.actividad,
    ),
    ciiuCode: text(data.ciiuCode ?? data.codigoCiiu),
    accountingRequired:
      typeof data.accountingRequired === "boolean"
        ? data.accountingRequired
        : undefined,
    specialTaxpayer:
      typeof data.specialTaxpayer === "boolean"
        ? data.specialTaxpayer
        : undefined,
    withholdingAgent:
      typeof data.withholdingAgent === "boolean"
        ? data.withholdingAgent
        : undefined,
    sourceUpdatedAt: text(data.sourceUpdatedAt),
  };
}

type IndexedTaxpayerRecord = {
  ruc: string;
  legalName: string;
  tradeName?: string;
  taxpayerStatus?: string;
  taxpayerClass?: string;
  taxpayerType?: string;
  taxRegime?: string;
  contribuyenteRimpe?: string;
  economicActivity?: string;
  ciiuCode?: string;
  province?: string;
  city?: string;
  parish?: string;
  accountingRequired?: boolean;
  specialTaxpayer?: boolean;
  withholdingAgent?: boolean;
  source: string;
  sourceUpdatedAt?: Date;
};

type IndexedTaxpayerStore = {
  findByRuc(ruc: string): Promise<IndexedTaxpayerRecord | null>;
};

export class IndexedSriTaxpayerProvider implements SriTaxpayerProvider {
  private readonly store?: IndexedTaxpayerStore;

  constructor(store?: IndexedTaxpayerStore) {
    this.store = store;
  }

  async lookup(identification: string): Promise<SriTaxpayerLookupResult> {
    const queriedAt = new Date().toISOString();
    if (identification.length !== 13)
      return { found: false, identification, queriedAt };

    try {
      const store =
        this.store ??
        new (await import("./sri-data-service.ts")).PrismaSriTaxpayerStore(
          (await import("../db/prisma.ts")).getPrismaClient(),
        );
      const record = await store.findByRuc(identification);
      if (!record) return { found: false, identification, queriedAt };
      return normalizeTaxpayerResponse(
        {
          ...record,
          identification: record.ruc,
          sourceUpdatedAt: record.sourceUpdatedAt?.toISOString(),
        },
        identification,
        record.source,
        queriedAt,
      );
    } catch {
      // The local index is optional until its migration/import has been run.
      return { found: false, identification, queriedAt };
    }
  }
}

export class ConfiguredOpenDataProvider implements SriTaxpayerProvider {
  private readonly endpoint: string | undefined;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;
  constructor(
    endpoint = process.env.SRI_TAXPAYER_LOOKUP_URL?.trim(),
    token = process.env.SRI_TAXPAYER_LOOKUP_TOKEN?.trim(),
    timeoutMs = 5000,
  ) {
    this.endpoint = endpoint;
    this.token = token;
    this.timeoutMs = timeoutMs;
  }
  async lookup(identification: string): Promise<SriTaxpayerLookupResult> {
    const queriedAt = new Date().toISOString();
    if (!this.endpoint) return { found: false, identification, queriedAt };
    const url = new URL(this.endpoint);
    url.searchParams.set("identification", identification);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: this.token
          ? { Authorization: `Bearer ${this.token}` }
          : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      )
        throw new Error("TAXPAYER_PROVIDER_TIMEOUT");
      throw new Error("TAXPAYER_PROVIDER_UNAVAILABLE");
    }
    if (response.status === 404)
      return { found: false, identification, source: "OPEN_DATA", queriedAt };
    if (!response.ok) throw new Error("TAXPAYER_PROVIDER_UNAVAILABLE");
    const data = (await response.json()) as Record<string, unknown>;
    return normalizeTaxpayerResponse(
      data,
      identification,
      "OPEN_DATA",
      queriedAt,
    );
  }
}

export class CompositeSriTaxpayerProvider implements SriTaxpayerProvider {
  private readonly providers: readonly SriTaxpayerProvider[];
  constructor(providers: readonly SriTaxpayerProvider[]) {
    this.providers = providers;
  }
  async lookup(identification: string) {
    for (const provider of this.providers) {
      const result = await provider.lookup(identification);
      if (result.found) return result;
    }
    return {
      found: false,
      identification,
      queriedAt: new Date().toISOString(),
    } satisfies SriTaxpayerLookupResult;
  }
}

type CacheEntry = { expiresAt: number; value: SriTaxpayerLookupResult };
export class CachedSriTaxpayerProvider implements SriTaxpayerProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly provider: SriTaxpayerProvider;
  private readonly ttlMs: number;
  private readonly now: () => number;
  constructor(
    provider: SriTaxpayerProvider,
    ttlMs = 6 * 60 * 60 * 1000,
    now = () => Date.now(),
  ) {
    this.provider = provider;
    this.ttlMs = ttlMs;
    this.now = now;
  }
  async lookup(identification: string) {
    const cached = this.cache.get(identification);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    const value = await this.provider.lookup(identification);
    this.cache.set(identification, {
      expiresAt: this.now() + this.ttlMs,
      value,
    });
    return value;
  }
}

const defaultProvider = new CachedSriTaxpayerProvider(
  new CompositeSriTaxpayerProvider([
    new IndexedSriTaxpayerProvider(),
    new ConfiguredOpenDataProvider(),
  ]),
);
export async function lookupSriTaxpayer(
  rawIdentification: string,
  provider: SriTaxpayerProvider = defaultProvider,
) {
  const identification = rawIdentification.replace(/\D/g, "");
  if (
    identification.length === 13
      ? !isValidEcuadorRuc(identification)
      : !isValidEcuadorCedula(identification)
  )
    throw new Error("La identificación ecuatoriana no es válida.");
  return provider.lookup(identification);
}
