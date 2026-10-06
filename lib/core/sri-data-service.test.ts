import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverSriTaxpayerResources,
  getSriImportRunStatus,
  importNormalizedRecords,
  normalizeSriTaxpayerRow,
  parsePipeDelimitedLine,
  rowFromHeaders,
  SRI_OPEN_DATA_SOURCE,
  type NormalizedSriTaxpayerRecord,
  type SriTaxpayerStore,
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

test("descubrimiento falla limpiamente si la fuente no está disponible", async () => {
  const unavailable = (() =>
    Promise.resolve(new Response(null, { status: 503 }))) as typeof fetch;
  await assert.rejects(
    discoverSriTaxpayerResources(unavailable),
    /catálogo oficial \(503\)/,
  );
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
