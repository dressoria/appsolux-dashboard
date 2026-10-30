import test from "node:test";
import assert from "node:assert/strict";

import { formatPercentChange } from "./home-financial-summary.ts";

// ── Percent change ──

test("positive change shows +%", () => {
  const result = formatPercentChange(200, 100);
  assert.equal(result.text, "+100.0%");
  assert.equal(result.positive, true);
});

test("negative change shows -%", () => {
  const result = formatPercentChange(50, 100);
  assert.equal(result.text, "-50.0%");
  assert.equal(result.positive, false);
});

test("previous=0 current>0 shows 'Nuevo este mes'", () => {
  const result = formatPercentChange(150, 0);
  assert.equal(result.text, "Nuevo este mes");
  assert.equal(result.positive, true);
});

test("both=0 shows 'Sin cambios'", () => {
  const result = formatPercentChange(0, 0);
  assert.equal(result.text, "Sin cambios");
  assert.equal(result.positive, null);
});

test("no Infinity when previous=0", () => {
  const result = formatPercentChange(999, 0);
  assert.ok(!result.text.includes("Infinity"));
  assert.ok(!result.text.includes("NaN"));
});

test("small fractional change", () => {
  const result = formatPercentChange(103, 100);
  assert.equal(result.text, "+3.0%");
  assert.equal(result.positive, true);
});

test("zero change from non-zero", () => {
  const result = formatPercentChange(100, 100);
  assert.equal(result.text, "+0.0%");
  assert.equal(result.positive, true);
});
