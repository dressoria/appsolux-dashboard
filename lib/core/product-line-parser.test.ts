import assert from "node:assert/strict";
import test from "node:test";
import { parseProductLines } from "./product-line-parser";

test("parses quantity + product name", () => {
  const result = parseProductLines("20 dr melaxin exfoliante");
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 20);
  assert.equal(result[0].searchTerm, "dr melaxin exfoliante");
  assert.equal(result[0].lineNumber, 1);
});

test("parses quantity with x separator", () => {
  const result = parseProductLines("2 x creatina");
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 2);
  assert.equal(result[0].searchTerm, "creatina");
});

test("parses quantity with X separator (uppercase)", () => {
  const result = parseProductLines("3X ibuprofeno 400mg");
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 3);
  assert.equal(result[0].searchTerm, "ibuprofeno 400mg");
});

test("parses multiple lines", () => {
  const input = "20 dr melaxin exfoliante\n10 drenaje\n3 chupagrass";
  const result = parseProductLines(input);
  assert.equal(result.length, 3);
  assert.equal(result[0].quantity, 20);
  assert.equal(result[0].searchTerm, "dr melaxin exfoliante");
  assert.equal(result[1].quantity, 10);
  assert.equal(result[1].searchTerm, "drenaje");
  assert.equal(result[2].quantity, 3);
  assert.equal(result[2].searchTerm, "chupagrass");
});

test("skips empty lines", () => {
  const input = "5 aspirina\n\n\n3 paracetamol";
  const result = parseProductLines(input);
  assert.equal(result.length, 2);
  assert.equal(result[0].searchTerm, "aspirina");
  assert.equal(result[1].searchTerm, "paracetamol");
});

test("trims whitespace", () => {
  const result = parseProductLines("  10   aceite de castor  ");
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 10);
  assert.equal(result[0].searchTerm, "aceite de castor");
});

test("line without leading number defaults to quantity 1", () => {
  const result = parseProductLines("aceite de oliva");
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 1);
  assert.equal(result[0].searchTerm, "aceite de oliva");
});

test("preserves raw line", () => {
  const result = parseProductLines("5x creatina monohidratada");
  assert.equal(result[0].raw, "5x creatina monohidratada");
});

test("assigns sequential line numbers", () => {
  const input = "1 a\n\n2 b\n3 c";
  const result = parseProductLines(input);
  assert.equal(result[0].lineNumber, 1);
  assert.equal(result[1].lineNumber, 3);
  assert.equal(result[2].lineNumber, 4);
});

test("handles empty input", () => {
  assert.equal(parseProductLines("").length, 0);
  assert.equal(parseProductLines("   ").length, 0);
  assert.equal(parseProductLines("\n\n").length, 0);
});

test("zero quantity defaults to 1", () => {
  const result = parseProductLines("0 producto");
  assert.equal(result[0].quantity, 1);
});
