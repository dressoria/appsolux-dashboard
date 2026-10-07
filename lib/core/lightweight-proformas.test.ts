import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateProformaTotals } from "./proforma-calculations";

test("calcula bases, descuentos e IVA con la tarifa real de cada producto", () => {
  const result = calculateProformaTotals([
    { productId: "iva", quantity: 2, unitPrice: 10, discount: 2, taxRate: 15 },
    { productId: "cero", quantity: 1, unitPrice: 5, discount: 0, taxRate: 0 },
  ]);
  assert.equal(result.subtotal, 23);
  assert.equal(result.discount, 2);
  assert.equal(result.tax, 2.7);
  assert.equal(result.total, 25.7);
});

test("rechaza cantidades inválidas", () => {
  assert.throws(() =>
    calculateProformaTotals([
      { productId: "x", quantity: 0, unitPrice: 1, taxRate: 15 },
    ]),
  );
});

test("el guardado de proformas no crea ventas, movimientos ni documentos SRI", async () => {
  const source = await readFile(
    new URL("./lightweight-proformas.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /lightweightSale\.(create|update)/);
  assert.doesNotMatch(source, /lightweightStockMovement\.(create|update)/);
  assert.doesNotMatch(source, /sriDocument\.(create|update)/);
});

test("todas las lecturas y referencias maestras incluyen tenantId", async () => {
  const source = await readFile(
    new URL("./lightweight-proformas.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /where: \{ id, tenantId \}/);
  assert.match(source, /tenantId: input\.tenantId/);
});
