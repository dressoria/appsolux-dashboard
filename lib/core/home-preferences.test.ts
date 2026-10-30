import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SHORTCUT_KEYS,
  resolveShortcuts,
  validateShortcutKeys,
  isValidShortcutKey,
  getShortcutCatalog,
} from "./home-preferences.ts";

// ── Default shortcuts ──

test("default shortcuts has exactly 8 entries", () => {
  assert.equal(DEFAULT_SHORTCUT_KEYS.length, 8);
});

test("Documentos is included in defaults", () => {
  assert.ok(DEFAULT_SHORTCUT_KEYS.includes("documents"));
});

test("emit_invoice is first default", () => {
  assert.equal(DEFAULT_SHORTCUT_KEYS[0], "emit_invoice");
});

test("optional SRI is not in defaults", () => {
  assert.equal(DEFAULT_SHORTCUT_KEYS.includes("sri"), false);
});

test("optional configuration is not in defaults", () => {
  assert.equal(DEFAULT_SHORTCUT_KEYS.includes("configuration"), false);
});

// ── Shortcut catalog ──

test("catalog includes all 10 shortcuts", () => {
  const catalog = getShortcutCatalog();
  assert.equal(catalog.length, 10);
});

test("SRI and configuration are marked optional", () => {
  const catalog = getShortcutCatalog();
  const sri = catalog.find((c) => c.key === "sri");
  const config = catalog.find((c) => c.key === "configuration");
  assert.ok(sri?.optional);
  assert.ok(config?.optional);
});

// ── Resolution ──

test("resolveShortcuts returns entries in order", () => {
  const result = resolveShortcuts(["cash", "emit_invoice"]);
  assert.equal(result.length, 2);
  assert.equal(result[0].key, "cash");
  assert.equal(result[1].key, "emit_invoice");
});

test("resolveShortcuts skips unknown keys", () => {
  const result = resolveShortcuts(["emit_invoice", "nonexistent"]);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "emit_invoice");
});

test("resolveShortcuts deduplicates", () => {
  const result = resolveShortcuts(["emit_invoice", "emit_invoice"]);
  assert.equal(result.length, 1);
});

test("resolveShortcuts on defaults returns 8 entries with correct routes", () => {
  const result = resolveShortcuts(DEFAULT_SHORTCUT_KEYS);
  assert.equal(result.length, 8);
  assert.ok(result.every((r) => r.href.startsWith("/facturacion")));
});

// ── Validation ──

test("validateShortcutKeys accepts valid array", () => {
  const result = validateShortcutKeys(["emit_invoice", "products"]);
  assert.deepEqual(result, ["emit_invoice", "products"]);
});

test("validateShortcutKeys rejects non-array", () => {
  assert.equal(validateShortcutKeys("emit_invoice"), null);
  assert.equal(validateShortcutKeys(null), null);
  assert.equal(validateShortcutKeys(42), null);
});

test("validateShortcutKeys rejects invalid key", () => {
  assert.equal(validateShortcutKeys(["emit_invoice", "hacked_key"]), null);
});

test("validateShortcutKeys normalizes duplicates", () => {
  const result = validateShortcutKeys(["emit_invoice", "emit_invoice", "products"]);
  assert.deepEqual(result, ["emit_invoice", "products"]);
});

test("validateShortcutKeys rejects oversized array", () => {
  const big = Array.from({ length: 20 }, () => "emit_invoice");
  assert.equal(validateShortcutKeys(big), null);
});

test("isValidShortcutKey validates known keys", () => {
  assert.equal(isValidShortcutKey("emit_invoice"), true);
  assert.equal(isValidShortcutKey("sri"), true);
  assert.equal(isValidShortcutKey("configuration"), true);
});

test("isValidShortcutKey rejects bad input", () => {
  assert.equal(isValidShortcutKey("bad_key"), false);
  assert.equal(isValidShortcutKey(null), false);
  assert.equal(isValidShortcutKey(123), false);
  assert.equal(isValidShortcutKey(""), false);
});

// ── Route correctness ──

test("billing route is /billing", async () => {
  const { routes } = await import("@/config/routes.ts");
  assert.equal(routes.billing, "/billing");
});

test("Documentos shortcut points to facturacionDocuments", () => {
  const result = resolveShortcuts(["documents"]);
  assert.equal(result[0].href, "/facturacion/documents");
});
