import assert from "node:assert/strict";
import test from "node:test";

import {
  requireSriTaxRegime,
  resolveSriTaxRegime,
  UNKNOWN_SRI_TAX_REGIME_MESSAGE,
} from "./sri-tax-regime";

test("resuelve RIMPE emprendedor con la leyenda Facturom", () => {
  assert.deepEqual(resolveSriTaxRegime({ taxRegime: "RIMPE EMPRENDEDOR" }), {
    code: "RIMPE_EMPRENDEDOR",
    label: "CONTRIBUYENTE RÉGIMEN RIMPE",
    officialValue: "RIMPE EMPRENDEDOR",
  });
});

test("resuelve RIMPE negocio popular", () => {
  assert.equal(
    resolveSriTaxRegime({ contribuyenteRimpe: "RIMPE NEGOCIO POPULAR" })?.label,
    "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
  );
});

test("resuelve régimen general", () => {
  assert.equal(resolveSriTaxRegime({ taxRegime: "REGIMEN GENERAL" })?.code, "REGIMEN_GENERAL");
});

test("un dato desconocido no inventa régimen y bloquea emisión", () => {
  assert.equal(resolveSriTaxRegime({ taxRegime: "SOCIEDAD ANONIMA" }), null);
  assert.throws(
    () => requireSriTaxRegime({ taxRegime: null, contribuyenteRimpe: null }),
    new RegExp(UNKNOWN_SRI_TAX_REGIME_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("una actualización mensual puede cambiar el régimen persistible", () => {
  const previous = resolveSriTaxRegime({ taxRegime: "RIMPE EMPRENDEDOR" });
  const updated = resolveSriTaxRegime({ taxRegime: "REGIMEN GENERAL" });
  assert.equal(previous?.code, "RIMPE_EMPRENDEDOR");
  assert.equal(updated?.code, "REGIMEN_GENERAL");
  assert.notEqual(previous?.label, updated?.label);
});
