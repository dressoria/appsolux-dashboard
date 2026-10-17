import assert from "node:assert/strict";
import test, { mock, type TestContext } from "node:test";
import { resolve } from "node:path";
import { Prisma } from "@prisma/client";
import { treasuryStore } from "./treasury/test-store";

let bulk: typeof import("./product-bulk-update");
test.before(async () => {
  mock.module(resolve("lib/core/tenant-operational-access.ts"), { namedExports: { requireTenantOperationalAccess: async () => undefined } });
  bulk = await import("./product-bulk-update");
});
function setup(t: TestContext) {
  const store = treasuryStore(t, ["lightweightProduct", "lightweightStockMovement", "inventoryWarehouse", "inventoryMovement", "inventoryStockBalance"]);
  store.seed("lightweightProduct", { id: "product-a", type: "PRODUCT", name: "Original", primaryCode: "CODE-A", stock: 10, minStock: null, trackInventory: true, isActive: true, defaultWarehouseId: "warehouse-a", cost: new Prisma.Decimal(1), price: new Prisma.Decimal(10), price2: new Prisma.Decimal(0), price3: new Prisma.Decimal(0), price4: new Prisma.Decimal(0), taxCategory: "TAXABLE", taxRate: 15 });
  store.seed("inventoryWarehouse", { id: "warehouse-a", active: true, isDefault: true });
  store.seed("inventoryStockBalance", { productId: "product-a", warehouseId: "warehouse-a", quantity: new Prisma.Decimal(10) });
  return store;
}
const row = (changes: Record<string, unknown>, productId = "product-a") => ({ productId, productName: "Untrusted", primaryCode: null, changes });
for (const [target, direction, movementType, quantity] of [[25, "IN", "ADJUSTMENT_IN", 15], [3, "OUT", "ADJUSTMENT_OUT", 7]] as const) {
  test(`stock ${target} uses ${movementType} and updates both ledgers and balance`, async (t) => {
    const store = setup(t);
    const result = await bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: target })], "user-a");
    assert.equal(result.updated, 1);
    assert.equal(Number(store.rows("lightweightProduct")[0].stock), target);
    assert.equal(Number(store.rows("inventoryStockBalance")[0].quantity), target);
    assert.equal(store.rows("lightweightStockMovement")[0].quantity, target - 10);
    const movement = store.rows("inventoryMovement")[0];
    assert.equal(movement.direction, direction); assert.equal(movement.movementType, movementType);
    assert.equal(Number(movement.quantity), quantity); assert.equal(movement.sourceType, "BULK_UPDATE");
    assert.equal(movement.tenantId, "tenant-a"); assert.equal(movement.warehouseId, "warehouse-a");
  });
}
test("repeated and concurrent stock confirms do not apply stale deltas", async (t) => {
  const store = setup(t);
  const results = await Promise.all([bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 20 })], "user-a"), bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 20 })], "user-a")]);
  assert.equal(results.reduce((sum, result) => sum + result.updated, 0), 1);
  assert.equal(Number(store.rows("inventoryStockBalance")[0].quantity), 20);
  assert.equal(store.rows("inventoryMovement").length, 1);
});
test("datos updates allowed fields and prevents SERVICE/COMBO inventory activation", async (t) => {
  const store = setup(t);
  await bulk.confirmBulkUpdate("tenant-a", "datos", [row({ name: "Edited", description: "Description", isActive: false })], "user-a");
  assert.equal(store.rows("lightweightProduct")[0].name, "Edited"); assert.equal(store.rows("lightweightProduct")[0].isActive, false);
  assert.equal((await bulk.previewBulkUpdate("tenant-a", "datos", [row({ name: " " })])).counts.needsReview, 1);
  for (const type of ["SERVICE", "COMBO"]) {
    await store.db.lightweightProduct.update({ where: { id: "product-a" }, data: { type: type as "SERVICE" | "COMBO", trackInventory: false } });
    const preview = await bulk.previewBulkUpdate("tenant-a", "datos", [row({ trackInventory: true })]);
    assert.equal(preview.counts.needsReview, 1);
    assert.equal((await bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 50 })], "user-a")).updated, 0);
  }
});
test("precios normalizes money and VAT category/rate together", async (t) => {
  const store = setup(t);
  assert.equal((await bulk.confirmBulkUpdate("tenant-a", "precios", [row({ price: "12.50", price4: 18, taxCategory: "EXEMPT" })], "user-a")).updated, 1);
  const product = store.rows("lightweightProduct")[0];
  assert.equal(product.price, 12.5); assert.equal(product.price4, 18); assert.equal(product.taxCategory, "EXEMPT"); assert.equal(product.taxRate, 0);
  assert.equal((await bulk.previewBulkUpdate("tenant-a", "precios", [row({ price: -1 })])).counts.needsReview, 1);
  assert.equal((await bulk.previewBulkUpdate("tenant-a", "precios", [row({ taxCategory: "TAXABLE", taxRate: 99 })])).counts.needsReview, 1);
});
test("tenant, row limits, duplicate products and non-tracking stock are validated", async (t) => {
  const store = setup(t);
  assert.equal((await bulk.confirmBulkUpdate("tenant-b", "stock", [row({ stock: 99 })], "user-b")).updated, 0);
  assert.equal(store.rows("inventoryMovement").length, 0);
  await assert.rejects(bulk.previewBulkUpdate("tenant-a", "datos", []));
  await assert.rejects(bulk.previewBulkUpdate("tenant-a", "datos", Array.from({ length: 5001 }, () => row({ name: "X" }))));
  await assert.rejects(bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 20 }), row({ stock: 30 })], "user-a"));
  await store.db.lightweightProduct.update({ where: { id: "product-a" }, data: { trackInventory: false } });
  assert.equal((await bulk.previewBulkUpdate("tenant-a", "stock", [row({ stock: 99 })])).counts.needsReview, 1);
});
test("missing/foreign warehouse cannot silently skip Inventory Core", async (t) => {
  const store = setup(t);
  await store.db.inventoryWarehouse.update({ where: { id: "warehouse-a" }, data: { tenantId: "tenant-b" } });
  await assert.rejects(bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 50 })], "user-a"), /bodega/);
  assert.equal(store.rows("inventoryMovement").length, 0);
  assert.equal(Number(store.rows("lightweightProduct")[0].stock), 10);
});
test("movement failure rolls back the entire stock batch", async (t) => {
  const store = setup(t); store.failAfter("inventoryMovement", 0);
  await assert.rejects(bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 50 })], "user-a"), /INJECTED_FAILURE/);
  assert.equal(store.rows("lightweightStockMovement").length, 0);
  assert.equal(Number(store.rows("inventoryStockBalance")[0].quantity), 10);
  assert.equal(Number(store.rows("lightweightProduct")[0].stock), 10);
});

test("a new warehouse balance contains only the adjustment delta, not other warehouses' stock", async (t) => {
  const store = setup(t);
  await store.db.inventoryStockBalance.updateMany({ data: { warehouseId: "other-warehouse" } });
  await bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 15 })], "user-a");
  const balances = store.rows("inventoryStockBalance");
  assert.equal(balances.reduce((sum, b) => sum + Number(b.quantity), 0), 15);
  assert.equal(Number(balances.find((b) => b.warehouseId === "warehouse-a")!.quantity), 5);
});
test("stock adjustment rejects inconsistent Core balances and a reduction beyond the selected warehouse", async (t) => {
  const store = setup(t);
  await store.db.inventoryStockBalance.updateMany({ data: { quantity: new Prisma.Decimal(8) } });
  await assert.rejects(bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 15 })], "user-a"), /Reconcilia/);
  await store.db.inventoryStockBalance.updateMany({ data: { quantity: new Prisma.Decimal(10), warehouseId: "other-warehouse" } });
  await assert.rejects(bulk.confirmBulkUpdate("tenant-a", "stock", [row({ stock: 5 })], "user-a"), /Stock insuficiente/);
  assert.equal(store.rows("inventoryMovement").length, 0);
});
