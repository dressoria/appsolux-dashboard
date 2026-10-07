import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoverSriTaxpayerResources,
  discoverSriResourcesFromHtml,
  getSriImportRunStatus,
  importNormalizedRecords,
  normalizeSriTaxpayerRow,
  parsePipeDelimitedLine,
  isAllowedSriDataUrl,
  rowFromHeaders,
  SRI_OPEN_DATA_SOURCE,
  SRI_PROVINCES,
  type NormalizedSriTaxpayerRecord,
  type SriTaxpayerStore,
  validateSriTaxpayerResource,
} from "./sri-data-service.ts";
import { IndexedSriTaxpayerProvider } from "./sri-taxpayer-lookup.ts";

class MemoryStore implements SriTaxpayerStore {
  readonly records = new Map<string, NormalizedSriTaxpayerRecord>();

  async findByRuc(ruc: string) {
    return this.records.get(ruc) ?? null;
  }

  async apply(records: NormalizedSriTaxpayerRecord[]) {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    for (const record of records) {
      const current = this.records.get(record.ruc);
      if (!current) inserted++;
      else if (JSON.stringify(current) === JSON.stringify(record)) unchanged++;
      else updated++;
      this.records.set(record.ruc, record);
    }
    return { inserted, updated, unchanged };
  }
}

const sourceRow = (overrides: Record<string, string> = {}) => ({
  NUMERO_RUC: "1790016919001",
  RAZON_SOCIAL: "  EMPRESA   DE PRUEBA S.A. ",
  NUMERO_ESTABLECIMIENTO: "001",
  NOMBRE_FANTASIA_COMERCIAL: "PRUEBA",
  ESTADO_CONTRIBUYENTE: "ACTIVO",
  CLASE_CONTRIBUYENTE: "OTROS",
  TIPO_CONTRIBUYENTE: "SOCIEDAD",
  ACTIVIDAD_ECONOMICA: "SERVICIOS",
  CODIGO_CIIU: "J620100",
  DESCRIPCION_PROVINCIA_EST: "PICHINCHA",
  DESCRIPCION_CANTON_EST: "QUITO",
  DESCRIPCION_PARROQUIA_EST: "IÑAQUITO",
  ESTADO_ESTABLECIMIENTO: "ABIERTO",
  OBLIGADO: "SI",
  ESPECIAL: "NO",
  AGENTE_RETENCION: "S",
  FECHA_ACTUALIZACION: "2026-08-01",
  ...overrides,
});

async function* records(...items: Array<NormalizedSriTaxpayerRecord | null>) {
  yield* items;
}

test("normaliza una fila oficial sin inventar campos", () => {
  const result = normalizeSriTaxpayerRow(sourceRow());
  assert.equal(result?.legalName, "EMPRESA DE PRUEBA S.A.");
  assert.equal(result?.source, SRI_OPEN_DATA_SOURCE);
  assert.equal("address" in (result ?? {}), false);
  assert.equal(result?.taxRegime, undefined);
  assert.equal(result?.contribuyenteRimpe, undefined);
});

test("mapea ubicación y banderas del establecimiento matriz", () => {
  const result = normalizeSriTaxpayerRow(sourceRow());
  assert.deepEqual(
    [result?.province, result?.city, result?.parish],
    ["PICHINCHA", "QUITO", "IÑAQUITO"],
  );
  assert.equal(result?.accountingRequired, true);
  assert.equal(result?.specialTaxpayer, false);
  assert.equal(result?.withholdingAgent, true);
});

test("descarta una fila corrupta", () => {
  assert.equal(normalizeSriTaxpayerRow(sourceRow({ NUMERO_RUC: "abc" })), null);
});

test("descarta establecimientos que no son matriz", () => {
  assert.equal(
    normalizeSriTaxpayerRow(sourceRow({ NUMERO_ESTABLECIMIENTO: "002" })),
    null,
  );
});

test("interpreta el encabezado y una fila delimitada por pipes", () => {
  const headers = parsePipeDelimitedLine("\uFEFFNUMERO_RUC|RAZON_SOCIAL");
  assert.deepEqual(rowFromHeaders(headers, ["123", "ACME"]), {
    NUMERO_RUC: "123",
    RAZON_SOCIAL: "ACME",
  });
});

test("importa registros válidos y contabiliza filas inválidas", async () => {
  const store = new MemoryStore();
  const valid = normalizeSriTaxpayerRow(sourceRow());
  const summary = await importNormalizedRecords(records(valid, null), store, 1);
  assert.deepEqual(summary, {
    recordsRead: 2,
    inserted: 1,
    updated: 0,
    unchanged: 0,
    errors: 1,
  });
});

test("upsert distingue actualización de registro sin cambios", async () => {
  const store = new MemoryStore();
  const initial = normalizeSriTaxpayerRow(sourceRow())!;
  await importNormalizedRecords(records(initial), store);
  const same = await importNormalizedRecords(records(initial), store);
  const changed = await importNormalizedRecords(
    records({ ...initial, tradeName: "NUEVO NOMBRE" }),
    store,
  );
  assert.equal(same.unchanged, 1);
  assert.equal(changed.updated, 1);
});

test("proveedor indexado devuelve un contribuyente encontrado", async () => {
  const store = new MemoryStore();
  const taxpayer = normalizeSriTaxpayerRow(sourceRow())!;
  await store.apply([taxpayer]);
  const result = await new IndexedSriTaxpayerProvider(store).lookup(
    taxpayer.ruc,
  );
  assert.equal(result.found, true);
  if (result.found) assert.equal(result.legalName, taxpayer.legalName);
});

test("proveedor indexado devuelve found false cuando no existe", async () => {
  const result = await new IndexedSriTaxpayerProvider(new MemoryStore()).lookup(
    "1790016919001",
  );
  assert.equal(result.found, false);
});

test("descubrimiento falla limpiamente si las fuentes no están disponibles", async () => {
  const unavailable = (() =>
    Promise.resolve(new Response(null, { status: 503 }))) as typeof fetch;
  assert.deepEqual(await discoverSriTaxpayerResources(unavailable), []);
});

const officialHtml = SRI_PROVINCES.map(
  (province) =>
    `<a href="https://descargas.sri.gob.ec/download/datosAbiertos/SRI_RUC_${province
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ /g, "_")}.zip">Descargar</a>`,
).join("\n");

test("discovery oficial encuentra las 24 provincias", () => {
  const resources = discoverSriResourcesFromHtml(officialHtml);
  assert.equal(resources.length, 24);
  assert.deepEqual(new Set(resources.map((resource) => resource.province)), new Set(SRI_PROVINCES));
});

test("CKAN 403 no aborta cuando SRI directo funciona", async () => {
  let ckanCalls = 0;
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("datosabiertos.gob.ec")) {
      ckanCalls++;
      return new Response(null, { status: 403 });
    }
    return new Response(officialHtml, { status: 200 });
  }) as typeof fetch;
  const resources = await discoverSriTaxpayerResources(fetcher);
  assert.equal(resources.length, 24);
  assert.equal(ckanCalls, 0);
});

test("solo permite dominios oficiales SRI", () => {
  assert.equal(isAllowedSriDataUrl("https://descargas.sri.gob.ec/a.zip"), true);
  assert.equal(isAllowedSriDataUrl("https://www.sri.gob.ec/datasets"), true);
  assert.equal(isAllowedSriDataUrl("https://sri.gob.ec.evil.example/a.zip"), false);
  assert.equal(isAllowedSriDataUrl("http://descargas.sri.gob.ec/a.zip"), false);
});

test("valida la firma de un ZIP oficial sin descargarlo completo", async () => {
  const fetcher = (async () =>
    new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
      status: 206,
      headers: {
        "content-type": "application/zip",
        "content-range": "bytes 0-3/4096",
      },
    })) as typeof fetch;
  const metadata = await validateSriTaxpayerResource(
    {
      province: "Azuay",
      url: "https://descargas.sri.gob.ec/download/datosAbiertos/SRI_RUC_Azuay.zip",
    },
    fetcher,
  );
  assert.equal(metadata.fileType, "application/zip");
  assert.equal(metadata.sizeBytes, 4096);
});

test("una importación parcial conserva datos previos y nunca trunca", async () => {
  const store = new MemoryStore();
  const original = normalizeSriTaxpayerRow(sourceRow())!;
  await store.apply([original]);
  await importNormalizedRecords(records(null), store);
  assert.deepEqual(await store.findByRuc(original.ruc), original);
});

test("el importador no contiene operaciones destructivas y dry-run termina antes de escribir", async () => {
  const source = await readFile(
    new URL("../../scripts/sri-import-taxpayers.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\bTRUNCATE\b|\.deleteMany\s*\(/i);
  assert.ok(source.indexOf("if (dryRun)") < source.indexOf("sriTaxpayerImportRun.create"));
});

test("una importación parcial nunca se marca como completada", () => {
  assert.equal(
    getSriImportRunStatus({ filesProcessed: 23, errors: 1 }, 24),
    "partial",
  );
  assert.equal(
    getSriImportRunStatus({ filesProcessed: 24, errors: 0 }, 24),
    "succeeded",
  );
});
