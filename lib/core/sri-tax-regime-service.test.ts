import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSriTaxRegime,
  type SriTaxRegimeCode,
} from "./sri-tax-regime";

// ---------------------------------------------------------------------------
// Fixtures: the three real tenant profiles confirmed via PostgreSQL
// ---------------------------------------------------------------------------

const BIONVERS = {
  ruc: "0993376581001",
  contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN GENERAL",
  taxRegimeCode: "REGIMEN_GENERAL" as SriTaxRegimeCode,
  accountingRequired: true,
};

const CESAR_PARRALES = {
  ruc: "0950929065001",
  contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN GENERAL",
  taxRegimeCode: "REGIMEN_GENERAL" as SriTaxRegimeCode,
  accountingRequired: false,
};

const WILSON_SORIA = {
  ruc: "0604157553001",
  contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN RIMPE",
  taxRegimeCode: "RIMPE_EMPRENDEDOR" as SriTaxRegimeCode,
  accountingRequired: false,
};

const PROFILES = [
  { name: "BIONVERS S.A.S.", ...BIONVERS },
  { name: "CESAR PARRALES", ...CESAR_PARRALES },
  { name: "WILSON SORIA", ...WILSON_SORIA },
];

// ---------------------------------------------------------------------------
// Helpers that mirror the fallback chain in resolveAndPersistSriTaxRegime()
// ---------------------------------------------------------------------------

function daysAgoMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

const CACHE_MAX_AGE_MS = 35 * 24 * 60 * 60 * 1000;

function simulateStep1(localCache: {
  taxRegime: string | null;
  contribuyenteRimpe: string | null;
  updatedAt: Date;
} | null) {
  if (!localCache) return null;
  const localIsRecent =
    Date.now() - localCache.updatedAt.getTime() <= CACHE_MAX_AGE_MS;
  if (!localIsRecent) return null;
  return resolveSriTaxRegime(localCache);
}

function simulateStep2(providerAvailable: boolean, providerData: {
  taxRegime: string | null;
  contribuyenteRimpe: string | null;
} | null) {
  if (!providerAvailable || !providerData) return null;
  return resolveSriTaxRegime(providerData);
}

function simulateStep3(profile: {
  contribuyenteRimpe: string | null;
}) {
  if (!profile.contribuyenteRimpe) return null;
  return resolveSriTaxRegime({
    taxRegime: profile.contribuyenteRimpe,
    contribuyenteRimpe: profile.contribuyenteRimpe,
  });
}

function simulateStep4(profile: {
  contribuyenteRimpe: string | null;
  taxRegimeCode: string | null;
}) {
  if (!profile.taxRegimeCode) return null;
  return {
    code: profile.taxRegimeCode as SriTaxRegimeCode,
    label: profile.contribuyenteRimpe || profile.taxRegimeCode,
    officialValue: profile.contribuyenteRimpe || profile.taxRegimeCode,
  };
}

function simulateFullChain(params: {
  localCache: { taxRegime: string | null; contribuyenteRimpe: string | null; updatedAt: Date } | null;
  providerAvailable: boolean;
  providerData: { taxRegime: string | null; contribuyenteRimpe: string | null } | null;
  profile: { contribuyenteRimpe: string | null; taxRegimeCode: string | null };
}) {
  return (
    simulateStep1(params.localCache) ??
    simulateStep2(params.providerAvailable, params.providerData) ??
    simulateStep3(params.profile) ??
    simulateStep4(params.profile)
  );
}

// ---------------------------------------------------------------------------
// Tests: each profile resolves with stale/expired caches & provider down
// ---------------------------------------------------------------------------

for (const fixture of PROFILES) {
  const profile = {
    contribuyenteRimpe: fixture.contribuyenteRimpe,
    taxRegimeCode: fixture.taxRegimeCode,
  };

  test(`${fixture.name}: resuelve con caché local reciente (< 35 días)`, () => {
    const result = simulateFullChain({
      localCache: {
        taxRegime: fixture.contribuyenteRimpe,
        contribuyenteRimpe: fixture.contribuyenteRimpe,
        updatedAt: new Date(Date.now() - daysAgoMs(10)),
      },
      providerAvailable: true,
      providerData: null,
      profile,
    });
    assert.ok(result, "Debe resolver el régimen");
    assert.equal(result!.code, fixture.taxRegimeCode);
  });

  for (const days of [36, 90, 365]) {
    test(`${fixture.name}: resuelve con caché de ${days} días y proveedor caído`, () => {
      const result = simulateFullChain({
        localCache: {
          taxRegime: fixture.contribuyenteRimpe,
          contribuyenteRimpe: fixture.contribuyenteRimpe,
          updatedAt: new Date(Date.now() - daysAgoMs(days)),
        },
        providerAvailable: false,
        providerData: null,
        profile,
      });
      assert.ok(result, `No debe fallar con caché de ${days} días y proveedor inactivo`);
      assert.equal(result!.code, fixture.taxRegimeCode);
    });
  }

  test(`${fixture.name}: resuelve sin caché local ni proveedor (solo perfil)`, () => {
    const result = simulateFullChain({
      localCache: null,
      providerAvailable: false,
      providerData: null,
      profile,
    });
    assert.ok(result, "Debe resolver desde el perfil persistido");
    assert.equal(result!.code, fixture.taxRegimeCode);
  });

  test(`${fixture.name}: resuelve con proveedor activo y caché vencida`, () => {
    const result = simulateFullChain({
      localCache: {
        taxRegime: fixture.contribuyenteRimpe,
        contribuyenteRimpe: fixture.contribuyenteRimpe,
        updatedAt: new Date(Date.now() - daysAgoMs(100)),
      },
      providerAvailable: true,
      providerData: {
        taxRegime: fixture.contribuyenteRimpe,
        contribuyenteRimpe: fixture.contribuyenteRimpe,
      },
      profile,
    });
    assert.ok(result, "Debe resolver con datos del proveedor");
    assert.equal(result!.code, fixture.taxRegimeCode);
  });
}

// ---------------------------------------------------------------------------
// Step 3 vs Step 4 precedence
// ---------------------------------------------------------------------------

test("Step 3 (contribuyenteRimpe) tiene precedencia sobre Step 4 (taxRegimeCode)", () => {
  const result = simulateFullChain({
    localCache: null,
    providerAvailable: false,
    providerData: null,
    profile: {
      contribuyenteRimpe: "CONTRIBUYENTE RÉGIMEN RIMPE",
      taxRegimeCode: "REGIMEN_GENERAL",
    },
  });
  assert.equal(result!.code, "RIMPE_EMPRENDEDOR");
});

// ---------------------------------------------------------------------------
// RUC change: profile wiped → must NOT resolve
// ---------------------------------------------------------------------------

test("perfil sin contribuyenteRimpe ni taxRegimeCode no resuelve (simula cambio de RUC)", () => {
  const result = simulateFullChain({
    localCache: null,
    providerAvailable: false,
    providerData: null,
    profile: { contribuyenteRimpe: null, taxRegimeCode: null },
  });
  assert.equal(result, null, "No debe inventar un régimen tras cambio de RUC");
});

// ---------------------------------------------------------------------------
// Datos desconocidos: no debe inventar régimen
// ---------------------------------------------------------------------------

test("dato no reconocible no inventa régimen", () => {
  const result = simulateFullChain({
    localCache: null,
    providerAvailable: false,
    providerData: null,
    profile: { contribuyenteRimpe: "SOCIEDAD ANONIMA XYZ", taxRegimeCode: null },
  });
  assert.equal(result, null, "No debe inventar un régimen para datos desconocidos");
});

// ---------------------------------------------------------------------------
// Isolation: datos de otro tenant no contaminan
// ---------------------------------------------------------------------------

test("cada perfil se resuelve independientemente", () => {
  const resultBionvers = simulateStep3({ contribuyenteRimpe: BIONVERS.contribuyenteRimpe });
  const resultWilson = simulateStep3({ contribuyenteRimpe: WILSON_SORIA.contribuyenteRimpe });
  assert.notEqual(resultBionvers!.code, resultWilson!.code, "Diferentes RUC tienen diferentes regímenes");
  assert.equal(resultBionvers!.code, "REGIMEN_GENERAL");
  assert.equal(resultWilson!.code, "RIMPE_EMPRENDEDOR");
});

// ---------------------------------------------------------------------------
// resolveSriTaxRegime pure-function edge cases
// ---------------------------------------------------------------------------

test("resolveSriTaxRegime con null y undefined no inventa", () => {
  assert.equal(resolveSriTaxRegime({ taxRegime: null, contribuyenteRimpe: null }), null);
  assert.equal(resolveSriTaxRegime({ taxRegime: undefined, contribuyenteRimpe: undefined }), null);
  assert.equal(resolveSriTaxRegime({}), null);
});

test("resolveSriTaxRegime normaliza acentos y guiones", () => {
  const r1 = resolveSriTaxRegime({ taxRegime: "RÉGIMEN GENERAL" });
  assert.equal(r1?.code, "REGIMEN_GENERAL");
  const r2 = resolveSriTaxRegime({ taxRegime: "REGIMEN-GENERAL" });
  assert.equal(r2?.code, "REGIMEN_GENERAL");
});

test("CONTRIBUYENTE NEGOCIO POPULAR se clasifica como RIMPE_NEGOCIO_POPULAR", () => {
  const r = resolveSriTaxRegime({ contribuyenteRimpe: "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE" });
  assert.equal(r?.code, "RIMPE_NEGOCIO_POPULAR");
});
