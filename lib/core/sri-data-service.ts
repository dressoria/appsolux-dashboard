import type { PrismaClient } from "@prisma/client";

export const SRI_OPEN_DATA_CATALOG_API =
  "https://www.datosabiertos.gob.ec/api/3/action/package_search?q=Registro%20Unico%20de%20Contribuyentes&rows=100";
export const SRI_DATASETS_URL = "https://www.sri.gob.ec/web/intersri/datasets";
export const SRI_OPEN_DATA_SOURCE = "SRI_DATOS_ABIERTOS_RUC";
export const SRI_EXPECTED_PROVINCE_COUNT = 24;
export const SRI_DATA_USER_AGENT = "Facturom-SRI-Data/1.0";

export const SRI_PROVINCES = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
  "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
  "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza",
  "Pichincha", "Santa Elena", "Santo Domingo", "Sucumbíos", "Tungurahua",
  "Zamora Chinchipe",
] as const;

export type SriTaxpayerDatasetResource = {
  province: string;
  url: string;
  modifiedAt?: string;
  fileType?: string;
  sizeBytes?: number;
};
export type NormalizedSriTaxpayerRecord = {
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
  establishmentStatus?: string;
  accountingRequired?: boolean;
  specialTaxpayer?: boolean;
  withholdingAgent?: boolean;
  source: string;
  sourceUpdatedAt?: Date;
};
export type ImportSummary = {
  filesProcessed: number;
  recordsRead: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
};
export type SriImportRunStatus = "succeeded" | "partial" | "failed";
export interface SriTaxpayerStore {
  apply(
    records: NormalizedSriTaxpayerRecord[],
  ): Promise<Pick<ImportSummary, "inserted" | "updated" | "unchanged">>;
  findByRuc(ruc: string): Promise<NormalizedSriTaxpayerRecord | null>;
}

export function getSriImportRunStatus(
  summary: Pick<ImportSummary, "filesProcessed" | "errors">,
  expectedFiles: number,
): SriImportRunStatus {
  if (
    summary.filesProcessed === expectedFiles &&
    expectedFiles > 0 &&
    summary.errors === 0
  )
    return "succeeded";
  return summary.filesProcessed > 0 ? "partial" : "failed";
}

const clean = (value: string | undefined) =>
  value?.trim().replace(/\s+/g, " ") || undefined;
const yesNo = (value: string | undefined) =>
  value === undefined || value.trim() === ""
    ? undefined
    : ["S", "SI", "SÍ", "1", "TRUE"].includes(value.trim().toUpperCase());
const date = (value: string | undefined) => {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value.trim().replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export function parsePipeDelimitedLine(line: string) {
  return line.replace(/^\uFEFF/, "").split("|");
}
export function rowFromHeaders(headers: string[], values: string[]) {
  return Object.fromEntries(
    headers.map((header, index) => [
      header.trim(),
      values[index]?.trim() ?? "",
    ]),
  );
}

export function normalizeSriTaxpayerRow(
  row: Record<string, string>,
): NormalizedSriTaxpayerRecord | null {
  const ruc = clean(row.NUMERO_RUC);
  const legalName = clean(row.RAZON_SOCIAL);
  const establishment = clean(row.NUMERO_ESTABLECIMIENTO);
  if (
    !ruc ||
    !/^\d{13}$/.test(ruc) ||
    !legalName ||
    (establishment && Number(establishment) !== 1)
  )
    return null;
  return {
    ruc,
    legalName,
    tradeName: clean(row.NOMBRE_FANTASIA_COMERCIAL),
    taxpayerStatus: clean(row.ESTADO_CONTRIBUYENTE),
    taxpayerClass: clean(row.CLASE_CONTRIBUYENTE),
    taxpayerType: clean(row.TIPO_CONTRIBUYENTE),
    economicActivity: clean(row.ACTIVIDAD_ECONOMICA),
    ciiuCode: clean(row.CODIGO_CIIU),
    province: clean(row.DESCRIPCION_PROVINCIA_EST),
    city: clean(row.DESCRIPCION_CANTON_EST),
    parish: clean(row.DESCRIPCION_PARROQUIA_EST),
    establishmentStatus: clean(row.ESTADO_ESTABLECIMIENTO),
    accountingRequired: yesNo(row.OBLIGADO),
    specialTaxpayer: yesNo(row.ESPECIAL),
    withholdingAgent: yesNo(row.AGENTE_RETENCION),
    source: SRI_OPEN_DATA_SOURCE,
    sourceUpdatedAt: date(row.FECHA_ACTUALIZACION),
  };
}

const comparable = (record: NormalizedSriTaxpayerRecord) =>
  JSON.stringify({
    ...record,
    sourceUpdatedAt: record.sourceUpdatedAt?.toISOString(),
  });
export class PrismaSriTaxpayerStore implements SriTaxpayerStore {
  private readonly prisma: PrismaClient;
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  async findByRuc(ruc: string) {
    const record = await this.prisma.sriTaxpayerRecord.findUnique({
      where: { ruc },
    });
    return record ? toNormalized(record) : null;
  }
  async apply(records: NormalizedSriTaxpayerRecord[]) {
    if (!records.length) return { inserted: 0, updated: 0, unchanged: 0 };
    const existing = await this.prisma.sriTaxpayerRecord.findMany({
      where: { ruc: { in: records.map((record) => record.ruc) } },
    });
    const map = new Map(
      existing.map((record) => [record.ruc, toNormalized(record)]),
    );
    const additions = records.filter((record) => !map.has(record.ruc));
    const changes = records.filter((record) => {
      const current = map.get(record.ruc);
      return current && comparable(current) !== comparable(record);
    });
    if (additions.length)
      await this.prisma.sriTaxpayerRecord.createMany({
        data: additions,
        skipDuplicates: true,
      });
    if (changes.length)
      await this.prisma.$transaction(
        changes.map((record) =>
          this.prisma.sriTaxpayerRecord.update({
            where: { ruc: record.ruc },
            data: { ...record, importedAt: new Date() },
          }),
        ),
      );
    if (records.length) {
      const matchingProfiles = await this.prisma.sriTaxpayerProfile.findMany({
        where: { ruc: { in: records.map((record) => record.ruc) } },
        select: { ruc: true },
      });
      const profileRucs = new Set(matchingProfiles.map((profile) => profile.ruc));
      const profileRecords = records.filter((record) => profileRucs.has(record.ruc));
      if (profileRecords.length) await this.prisma.$transaction(
        profileRecords.map((record) => {
          return this.prisma.sriTaxpayerProfile.updateMany({
            where: { ruc: record.ruc },
            data: {
              taxpayerStatus: record.taxpayerStatus,
              taxpayerClass: record.taxpayerClass,
              taxpayerType: record.taxpayerType,
              ...(record.accountingRequired == null
                ? {}
                : { accountingRequired: record.accountingRequired }),
            },
          });
        }),
      );
    }
    return {
      inserted: additions.length,
      updated: changes.length,
      unchanged: records.length - additions.length - changes.length,
    };
  }
}

function toNormalized(record: {
  ruc: string;
  legalName: string;
  tradeName: string | null;
  taxpayerStatus: string | null;
  taxpayerClass: string | null;
  taxpayerType: string | null;
  taxRegime: string | null;
  contribuyenteRimpe: string | null;
  economicActivity: string | null;
  ciiuCode: string | null;
  province: string | null;
  city: string | null;
  parish: string | null;
  establishmentStatus: string | null;
  accountingRequired: boolean | null;
  specialTaxpayer: boolean | null;
  withholdingAgent: boolean | null;
  source: string;
  sourceUpdatedAt: Date | null;
}): NormalizedSriTaxpayerRecord {
  return {
    ruc: record.ruc,
    legalName: record.legalName,
    tradeName: record.tradeName ?? undefined,
    taxpayerStatus: record.taxpayerStatus ?? undefined,
    taxpayerClass: record.taxpayerClass ?? undefined,
    taxpayerType: record.taxpayerType ?? undefined,
    taxRegime: record.taxRegime ?? undefined,
    contribuyenteRimpe: record.contribuyenteRimpe ?? undefined,
    economicActivity: record.economicActivity ?? undefined,
    ciiuCode: record.ciiuCode ?? undefined,
    province: record.province ?? undefined,
    city: record.city ?? undefined,
    parish: record.parish ?? undefined,
    establishmentStatus: record.establishmentStatus ?? undefined,
    accountingRequired: record.accountingRequired ?? undefined,
    specialTaxpayer: record.specialTaxpayer ?? undefined,
    withholdingAgent: record.withholdingAgent ?? undefined,
    source: record.source,
    sourceUpdatedAt: record.sourceUpdatedAt ?? undefined,
  };
}

const sriHeaders = (accept: string) => ({
  "User-Agent": SRI_DATA_USER_AGENT,
  Accept: accept,
});

const provinceKey = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export function isAllowedSriDataUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "sri.gob.ec" || url.hostname === "www.sri.gob.ec" ||
        url.hostname === "descargas.sri.gob.ec");
  } catch {
    return false;
  }
}

export function discoverSriResourcesFromHtml(html: string, baseUrl = SRI_DATASETS_URL) {
  const canonical = new Map(SRI_PROVINCES.map((name) => [provinceKey(name), name]));
  const resources = new Map<string, SriTaxpayerDatasetResource>();
  const hrefPattern = /href\s*=\s*["']([^"']*SRI_RUC_([^"'/?#]+)\.zip[^"']*)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const rawUrl = match[1].replace(/&amp;/g, "&");
    const url = new URL(rawUrl, baseUrl).toString().replace(/^http:/, "https:");
    const province = canonical.get(provinceKey(decodeURIComponent(match[2]).replace(/_/g, " ")));
    if (province && isAllowedSriDataUrl(url)) {
      resources.set(province, { province, url, fileType: "ZIP" });
    }
  }
  return [...resources.values()].sort((a, b) => a.province.localeCompare(b.province, "es"));
}

async function discoverSriResourcesFromCkan(
  fetcher: typeof fetch = fetch,
): Promise<SriTaxpayerDatasetResource[]> {
  const response = await fetcher(SRI_OPEN_DATA_CATALOG_API, {
    headers: sriHeaders("application/json"),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(
      `No se pudo consultar el catálogo oficial (${response.status}).`,
    );
  const payload = (await response.json()) as {
    success?: boolean;
    result?: {
      results?: Array<{
        name?: string;
        title?: string;
        metadata_modified?: string;
        organization?: { name?: string };
        resources?: Array<{ format?: string; url?: string }>;
      }>;
    };
  };
  if (!payload.success)
    throw new Error("El catálogo oficial devolvió una respuesta inválida.");
  return (payload.result?.results ?? [])
    .filter(
      (dataset) =>
        dataset.organization?.name === "sri-servicio-de-rentas-internas" &&
        dataset.name?.startsWith("registro-unico-de-contribuyentes-ruc-"),
    )
    .flatMap((dataset) => {
      const resource = dataset.resources?.find(
        (item) =>
          item.format?.toUpperCase() === "CSV" &&
          item.url?.toLowerCase().endsWith(".zip"),
      );
      return resource?.url
        ? [
            {
              province:
                dataset.title?.split("/").at(-1)?.trim() || dataset.name || "",
              url: resource.url.replace(/^http:/, "https:"),
              modifiedAt: dataset.metadata_modified,
              fileType: "ZIP",
            },
          ]
        : [];
    });
}

export async function discoverSriTaxpayerResources(
  fetcher: typeof fetch = fetch,
): Promise<SriTaxpayerDatasetResource[]> {
  let direct: SriTaxpayerDatasetResource[] = [];
  try {
    const response = await fetcher(SRI_DATASETS_URL, {
      headers: sriHeaders("text/html,application/xhtml+xml"),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) direct = discoverSriResourcesFromHtml(await response.text());
  } catch {
    // CKAN remains an optional fallback when the official SRI page is unavailable.
  }
  if (direct.length === SRI_EXPECTED_PROVINCE_COUNT) return direct;
  try {
    const fallback = await discoverSriResourcesFromCkan(fetcher);
    const merged = new Map(direct.map((resource) => [resource.province, resource]));
    for (const resource of fallback) {
      if (isAllowedSriDataUrl(resource.url) && !merged.has(resource.province))
        merged.set(resource.province, resource);
    }
    return [...merged.values()].sort((a, b) => a.province.localeCompare(b.province, "es"));
  } catch {
    return direct;
  }
}

export async function validateSriTaxpayerResource(
  resource: SriTaxpayerDatasetResource,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(resource.url);
  if (
    !resource.province.trim() ||
    url.protocol !== "https:" ||
    !isAllowedSriDataUrl(resource.url) ||
    !url.pathname.toLowerCase().endsWith(".zip")
  )
    throw new Error(
      `Recurso inválido para ${resource.province || "provincia desconocida"}.`,
    );

  const response = await fetcher(resource.url, {
    headers: { ...sriHeaders("application/zip,application/octet-stream"), Range: "bytes=0-3" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !response.body)
    throw new Error(
      `No se pudo validar ${resource.province} (${response.status}).`,
    );
  const reader = response.body.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  if (!value || value[0] !== 0x50 || value[1] !== 0x4b)
    throw new Error(`El recurso de ${resource.province} no es un ZIP válido.`);
  return {
    fileType: response.headers.get("content-type") ?? resource.fileType ?? "ZIP",
    sizeBytes: Number(response.headers.get("content-range")?.split("/").at(-1) ?? response.headers.get("content-length")) || resource.sizeBytes,
  };
}

export async function importNormalizedRecords(
  records: AsyncIterable<NormalizedSriTaxpayerRecord | null>,
  store: SriTaxpayerStore,
  batchSize = 500,
) {
  const summary = {
    recordsRead: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
  };
  let batch: NormalizedSriTaxpayerRecord[] = [];
  const flush = async () => {
    const result = await store.apply(batch);
    summary.inserted += result.inserted;
    summary.updated += result.updated;
    summary.unchanged += result.unchanged;
    batch = [];
  };
  for await (const record of records) {
    summary.recordsRead++;
    if (!record) {
      summary.errors++;
      continue;
    }
    batch.push(record);
    if (batch.length >= batchSize) await flush();
  }
  if (batch.length) await flush();
  return summary;
}
