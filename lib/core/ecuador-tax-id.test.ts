import assert from "node:assert/strict";
import test from "node:test";

import {
  getEcuadorRucType,
  isValidEcuadorCedula,
  isValidEcuadorRuc,
} from "./ecuador-tax-id.ts";

test("validates Ecuadorian cedulas with modulo 10", () => {
  assert.equal(isValidEcuadorCedula("1710034065"), true);
  assert.equal(isValidEcuadorCedula("1710034066"), false);
});

test("validates a natural-person RUC from its cedula and establishment", () => {
  assert.equal(isValidEcuadorRuc("1710034065001"), true);
  assert.equal(getEcuadorRucType("1710034065001"), "natural_person");
  assert.equal(isValidEcuadorRuc("1710034066001"), false);
});

test("accepts legacy and current private-company RUC structures", () => {
  // 1790016919001 follows the historical modulo-11 layout.
  assert.equal(isValidEcuadorRuc("1790016919001"), true);
  assert.equal(getEcuadorRucType("1790016919001"), "private_company");

  // Current SRI sequences do not assign the tenth position as a verifier.
  assert.equal(isValidEcuadorRuc("1793230411001"), true);
  assert.equal(getEcuadorRucType("1793230411001"), "private_company");
});

test("validates public-entity RUC structure", () => {
  assert.equal(isValidEcuadorRuc("1760013210001"), true);
  assert.equal(getEcuadorRucType("1760013210001"), "public_entity");
  assert.equal(isValidEcuadorRuc("1760013210000"), false);
});

test("rejects malformed or unsupported RUCs", () => {
  assert.equal(isValidEcuadorRuc("179323041100"), false);
  assert.equal(isValidEcuadorRuc("179323041100A"), false);
  assert.equal(isValidEcuadorRuc("1793230411000"), false);
  assert.equal(isValidEcuadorRuc("1783230411001"), false);
  assert.equal(isValidEcuadorRuc("2593230411001"), false);
});
