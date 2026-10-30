import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateIdentification,
  normalizeIdentification,
  getIdentificationMaxLength,
  getIdentificationInputMode,
  isForeignIdentificationType,
} from "./identification-rules.ts";
import { generatePdfTable } from "./pdf-table.ts";
import type { LightweightCustomerIdentificationType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Identification rules
// ---------------------------------------------------------------------------

describe("identification rules", () => {
  describe("RUC", () => {
    it("accepts valid 13-digit RUC", () => {
      const result = validateIdentification("RUC", "1790016919001");
      assert.equal(result, "1790016919001");
    });

    it("rejects non-13-digit value", () => {
      assert.throws(() => validateIdentification("RUC", "123456789"), /13 dígitos/);
    });

    it("maxLength is 13", () => {
      assert.equal(getIdentificationMaxLength("RUC"), 13);
    });

    it("input mode is numeric", () => {
      assert.equal(getIdentificationInputMode("RUC"), "numeric");
    });

    it("is not foreign", () => {
      assert.equal(isForeignIdentificationType("RUC"), false);
    });
  });

  describe("CEDULA", () => {
    it("accepts valid 10-digit cédula", () => {
      const result = validateIdentification("CEDULA", "1710034065");
      assert.equal(result.length, 10);
    });

    it("rejects non-10-digit value", () => {
      assert.throws(
        () => validateIdentification("CEDULA", "123"),
        /10 dígitos/,
      );
    });

    it("maxLength is 10", () => {
      assert.equal(getIdentificationMaxLength("CEDULA"), 10);
    });

    it("input mode is numeric", () => {
      assert.equal(getIdentificationInputMode("CEDULA"), "numeric");
    });

    it("is not foreign", () => {
      assert.equal(isForeignIdentificationType("CEDULA"), false);
    });
  });

  describe("PASSPORT", () => {
    it("accepts valid passport (3 chars)", () => {
      const result = validateIdentification("PASSPORT", "AB1");
      assert.equal(result, "AB1");
    });

    it("accepts valid passport (20 chars)", () => {
      const result = validateIdentification("PASSPORT", "AB12345678901234567C");
      assert.equal(result.length, 20);
    });

    it("rejects 2-char passport", () => {
      assert.throws(
        () => validateIdentification("PASSPORT", "AB"),
        /3 y 20/,
      );
    });

    it("rejects 21-char passport", () => {
      assert.throws(
        () => validateIdentification("PASSPORT", "A12345678901234567890"),
        /3 y 20/,
      );
    });

    it("normalizes to uppercase", () => {
      assert.equal(normalizeIdentification("PASSPORT", "abc"), "ABC");
    });

    it("maxLength is 20", () => {
      assert.equal(getIdentificationMaxLength("PASSPORT"), 20);
    });

    it("input mode is text", () => {
      assert.equal(getIdentificationInputMode("PASSPORT"), "text");
    });

    it("is foreign type", () => {
      assert.equal(isForeignIdentificationType("PASSPORT"), true);
    });
  });

  describe("FOREIGN_ID", () => {
    it("accepts valid foreign ID (3 chars)", () => {
      const result = validateIdentification("FOREIGN_ID", "X1Y");
      assert.equal(result, "X1Y");
    });

    it("accepts valid foreign ID (30 chars)", () => {
      const value = "A" + "1234567890".repeat(2) + "12345678B";
      const result = validateIdentification("FOREIGN_ID", value);
      assert.equal(result.length, 30);
    });

    it("rejects 2-char value", () => {
      assert.throws(
        () => validateIdentification("FOREIGN_ID", "AB"),
        /3 y 30/,
      );
    });

    it("rejects 31-char value", () => {
      const value = "A" + "0".repeat(29) + "B";
      assert.throws(
        () => validateIdentification("FOREIGN_ID", value),
        /3 y 30/,
      );
    });

    it("maxLength is 30", () => {
      assert.equal(getIdentificationMaxLength("FOREIGN_ID"), 30);
    });

    it("input mode is text", () => {
      assert.equal(getIdentificationInputMode("FOREIGN_ID"), "text");
    });

    it("is foreign type", () => {
      assert.equal(isForeignIdentificationType("FOREIGN_ID"), true);
    });
  });

  it("rejects unknown type", () => {
    assert.throws(
      () =>
        validateIdentification(
          "UNKNOWN" as LightweightCustomerIdentificationType,
          "1234",
        ),
      /no reconocido/,
    );
  });
});

// ---------------------------------------------------------------------------
// Pagination helpers (tested via page sanitize logic, mirrored here)
// ---------------------------------------------------------------------------

describe("pagination sanitize", () => {
  const ALLOWED_PER_PAGE = [10, 20, 50, 100];

  function sanitize(
    value: string | null,
    fallback: number,
    allowed?: number[],
  ): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return fallback;
    if (allowed && !allowed.includes(n)) return fallback;
    return Math.floor(n);
  }

  it("10 is allowed", () => assert.equal(sanitize("10", 20, ALLOWED_PER_PAGE), 10));
  it("20 is allowed", () => assert.equal(sanitize("20", 20, ALLOWED_PER_PAGE), 20));
  it("50 is allowed", () => assert.equal(sanitize("50", 20, ALLOWED_PER_PAGE), 50));
  it("100 is allowed", () => assert.equal(sanitize("100", 20, ALLOWED_PER_PAGE), 100));
  it("invalid perPage falls back to 20", () =>
    assert.equal(sanitize("25", 20, ALLOWED_PER_PAGE), 20));
  it("null falls back to 20", () =>
    assert.equal(sanitize(null, 20, ALLOWED_PER_PAGE), 20));
  it("negative falls back", () =>
    assert.equal(sanitize("-1", 20, ALLOWED_PER_PAGE), 20));
  it("NaN falls back", () =>
    assert.equal(sanitize("abc", 20, ALLOWED_PER_PAGE), 20));
  it("page 2 has correct skip", () => {
    const page = sanitize("2", 1);
    const perPage = sanitize("20", 20, ALLOWED_PER_PAGE);
    assert.equal((page - 1) * perPage, 20);
  });
  it("page 3 with perPage 50 has correct skip", () => {
    const page = sanitize("3", 1);
    const perPage = sanitize("50", 20, ALLOWED_PER_PAGE);
    assert.equal((page - 1) * perPage, 100);
  });
});

// ---------------------------------------------------------------------------
// PDF table generator
// ---------------------------------------------------------------------------

describe("pdf-table", () => {
  it("generates valid PDF", async () => {
    const buffer = await generatePdfTable({
      title: "Test",
      columns: [
        { header: "Col A", key: "a", width: 100 },
        { header: "Col B", key: "b", width: 100 },
      ],
      rows: [{ a: "Hello", b: "World" }],
    });
    assert.ok(buffer instanceof Uint8Array);
    assert.ok(buffer.length > 0);
    const header = new TextDecoder().decode(buffer.slice(0, 5));
    assert.equal(header, "%PDF-");
  });

  it("handles multi-page with many rows", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      a: `Row ${i + 1}`,
      b: `Value ${i + 1}`,
    }));
    const buffer = await generatePdfTable({
      title: "Multi-page test",
      columns: [
        { header: "Col A", key: "a", width: 150 },
        { header: "Col B", key: "b", width: 150 },
      ],
      rows,
    });
    assert.ok(buffer.length > 1000);
    const header = new TextDecoder().decode(buffer.slice(0, 5));
    assert.equal(header, "%PDF-");
  });

  it("handles long text without crash", async () => {
    const longText = "A".repeat(500);
    const buffer = await generatePdfTable({
      title: "Long text test",
      columns: [{ header: "Long", key: "long", width: 100 }],
      rows: [{ long: longText }],
    });
    assert.ok(buffer instanceof Uint8Array);
    assert.ok(buffer.length > 0);
  });

  it("renders landscape mode", async () => {
    const buffer = await generatePdfTable({
      title: "Landscape",
      columns: [{ header: "X", key: "x", width: 100 }],
      rows: [{ x: "1" }],
      landscape: true,
    });
    assert.ok(buffer.length > 0);
  });
});
