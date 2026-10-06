import assert from "node:assert/strict";
import test from "node:test";
import {
  CachedSriTaxpayerProvider,
  ConfiguredOpenDataProvider,
  normalizeTaxpayerResponse,
  type SriTaxpayerProvider,
} from "./sri-taxpayer-lookup.ts";

const RUC = "1751566751001";
const CEDULA = "1710034065";

test("normalizes a found RUC", () => {
  const result = normalizeTaxpayerResponse(
    { legalName: "EMPRESA REAL", estado: "ACTIVO" },
    RUC,
  );
  assert.equal(result.found, true);
  if (result.found) assert.equal(result.taxpayerStatus, "ACTIVO");
});
test("normalizes a missing RUC", () => {
  const result = normalizeTaxpayerResponse({ found: false }, RUC);
  assert.deepEqual(result.found, false);
});
test("normalizes a found cedula taxpayer record", () => {
  const result = normalizeTaxpayerResponse(
    { razonSocial: "PERSONA CONTRIBUYENTE" },
    CEDULA,
  );
  assert.equal(result.found, true);
});
test("treats a cedula without a taxpayer record as not found", () => {
  const result = normalizeTaxpayerResponse({ found: false }, CEDULA);
  assert.equal(result.found, false);
});
test("propagates provider outages", async () => {
  const provider: SriTaxpayerProvider = {
    lookup: async () => {
      throw new Error("TAXPAYER_PROVIDER_UNAVAILABLE");
    },
  };
  await assert.rejects(provider.lookup(RUC), /UNAVAILABLE/);
});
test("maps provider timeout to a safe code", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new DOMException("timeout", "TimeoutError");
  };
  try {
    await assert.rejects(
      new ConfiguredOpenDataProvider(
        "https://example.invalid",
        undefined,
        1,
      ).lookup(RUC),
      /TAXPAYER_PROVIDER_TIMEOUT/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("rejects incomplete external responses as not found", () => {
  assert.equal(
    normalizeTaxpayerResponse({ estado: "ACTIVO" }, RUC).found,
    false,
  );
});
test("normalizes accents, case and spaces in locations", () => {
  const result = normalizeTaxpayerResponse(
    {
      legalName: "X",
      provincia: "  PICHINCHA ",
      canton: "QUITO",
      parroquia: "COTOCOLLAO",
    },
    RUC,
  );
  assert.equal(result.found, true);
  if (result.found)
    assert.deepEqual(
      [result.province, result.city, result.parish],
      ["Pichincha", "Quito", "Cotocollao"],
    );
});
test("uses positive cache hits", async () => {
  let calls = 0;
  const provider: SriTaxpayerProvider = {
    lookup: async (identification) => {
      calls++;
      return normalizeTaxpayerResponse({ legalName: "X" }, identification);
    },
  };
  const cache = new CachedSriTaxpayerProvider(provider);
  await cache.lookup(RUC);
  await cache.lookup(RUC);
  assert.equal(calls, 1);
});
test("uses negative cache hits", async () => {
  let calls = 0;
  const provider: SriTaxpayerProvider = {
    lookup: async (identification) => {
      calls++;
      return {
        found: false,
        identification,
        queriedAt: new Date().toISOString(),
      };
    },
  };
  const cache = new CachedSriTaxpayerProvider(provider);
  await cache.lookup(CEDULA);
  await cache.lookup(CEDULA);
  assert.equal(calls, 1);
});
