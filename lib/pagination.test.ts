import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePage, sanitizePerPage, ALLOWED_PER_PAGE } from "./pagination";

test("sanitizePage returns 1 for falsy/invalid values", () => {
  assert.equal(sanitizePage(undefined), 1);
  assert.equal(sanitizePage(null), 1);
  assert.equal(sanitizePage(""), 1);
  assert.equal(sanitizePage("abc"), 1);
  assert.equal(sanitizePage(-1), 1);
  assert.equal(sanitizePage(0), 1);
});

test("sanitizePage floors valid positive numbers", () => {
  assert.equal(sanitizePage(1), 1);
  assert.equal(sanitizePage("3"), 3);
  assert.equal(sanitizePage(2.7), 2);
  assert.equal(sanitizePage("100"), 100);
});

test("sanitizePerPage returns 20 for invalid values", () => {
  assert.equal(sanitizePerPage(undefined), 20);
  assert.equal(sanitizePerPage(null), 20);
  assert.equal(sanitizePerPage(""), 20);
  assert.equal(sanitizePerPage(5), 20);
  assert.equal(sanitizePerPage(25), 20);
  assert.equal(sanitizePerPage("abc"), 20);
});

test("sanitizePerPage accepts all allowed values", () => {
  for (const n of ALLOWED_PER_PAGE) {
    assert.equal(sanitizePerPage(n), n);
    assert.equal(sanitizePerPage(String(n)), n);
  }
});

test("module has no 'use client' directive (safe for Server Components)", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./pagination.ts", import.meta.url), "utf-8");
  assert.ok(!source.includes('"use client"'), "lib/pagination.ts must not have 'use client'");
  assert.ok(!source.includes("'use client'"), "lib/pagination.ts must not have 'use client'");
});
