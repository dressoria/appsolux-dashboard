import assert from "node:assert/strict";
import test, { mock, type TestContext } from "node:test";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { treasuryStore } from "./treasury/test-store";
import type { ProductImportRow } from "./product-import";

let domain: typeof import("./product-import");
let previewApi: typeof import("../../app/api/inventory/products/import/preview/route");
let validateApi: typeof import("../../app/api/inventory/products/import/validate/route");
let confirmApi: typeof import("../../app/api/inventory/products/import/confirm/route");
let templateApi: typeof import("../../app/api/inventory/products/import/template/route");
test.before(async () => {
  mock.module(resolve("lib/core/tenant-operational-access.ts"), { namedExports: { requireTenantOperationalAccess: async () => undefined } });
  mock.module(resolve("lib/auth/current-user.ts"), { namedExports: { getCurrentUser: async () => ({ id: "user-a", tenant: { id: "tenant-a" } }) } });
  mock.module(resolve("lib/tenant/current-tenant.ts"), { namedExports: { getCurrentTenant: async () => ({ id: "tenant-a" }) } });
  domain = await import("./product-import");
  previewApi = await import("../../app/api/inventory/products/import/preview/route");
  validateApi = await import("../../app/api/inventory/products/import/validate/route");
  confirmApi = await import("../../app/api/inventory/products/import/confirm/route");
  templateApi = await import("../../app/api/inventory/products/import/template/route");
});
function setup(t: TestContext) {
  const store = treasuryStore(t, ["lightweightProduct", "lightweightProductCategory", "inventoryBrand", "inventoryUnit", "inventoryWarehouse", "inventoryMovement", "inventoryStockBalance", "accountingAccount"]);
  store.seed("inventoryWarehouse", { id: "warehouse-a", name: "Principal", code: "MAIN", isDefault: true, active: true });
  store.seed("inventoryUnit", { id: "unit-a", name: "Unidad", code: "UNIT", active: true });
  store.seed("inventoryWarehouse", { id: "warehouse-b", tenantId: "tenant-b", name: "Otra", code: "FOREIGN", active: true });
  return store;
}
function row(overrides: Partial<ProductImportRow>) {
  return { ...Object.fromEntries(domain.productImportColumns.map((field) => [field, ""])), nombre: "Importado", ...overrides } as ProductImportRow;
}
const request = (rows: unknown) => new NextRequest("http://localhost/api/inventory/products/import/confirm", { method: "POST", body: JSON.stringify({ rows, tenantId: "tenant-b" }), headers: { "content-type": "application/json" } });
test("v2 API preview -> validate -> confirm persists PRODUCT stock and virtual SERVICE/COMBO rules", async (t) => {
  const store = setup(t);
  const file = new FormData(); file.append("file", new File(["tipo,nombre,codigo,unidad,bodega,stock_inicial,controlar_inventario\nPRODUCTO,Producto,0001,UNIT,MAIN,5,\nSERVICIO,Servicio,0002,,,0,true\nCOMBO,Combo,0003,,,0,true"], "products.csv"));
  const previewResponse = await previewApi.POST(new NextRequest("http://localhost/api/inventory/products/import/preview", { method: "POST", body: file }));
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json(); assert.equal(preview.counts.ready, 3);
  assert.equal(store.rows("lightweightProduct").length, 0);
  const validateResponse = await validateApi.POST(request(preview.rows)); assert.equal(validateResponse.status, 200);
  const validated = await validateResponse.json(); assert.equal(validated.counts.ready, 3);
  const response = await confirmApi.POST(request(validated.rows)); assert.equal(response.status, 200);
  assert.equal((await response.json()).imported, 3);
  const products = store.rows("lightweightProduct");
  assert.ok(products.every((p) => p.tenantId === "tenant-a"));
  const product = products.find((p) => p.type === "PRODUCT")!;
  assert.equal(product.trackInventory, true); assert.equal(product.stock, 5); assert.equal(product.primaryCode, "0001");
  assert.equal(product.unitId, "unit-a"); assert.equal(product.defaultWarehouseId, "warehouse-a");
  for (const type of ["SERVICE", "COMBO"]) {
    const virtual = products.find((p) => p.type === type)!;
    assert.equal(virtual.trackInventory, false); assert.equal(virtual.defaultWarehouseId, null);
    assert.equal(store.rows("inventoryStockBalance").filter((b) => b.productId === virtual.id).length, 0);
  }
  assert.equal(store.rows("inventoryMovement").length, 1); assert.equal(store.rows("inventoryMovement")[0].movementType, "OPENING");
  assert.equal(Number(store.rows("inventoryStockBalance")[0].quantity), 5);
  const replay = await confirmApi.POST(request(validated.rows)); assert.equal(replay.status, 200);
  assert.equal((await replay.json()).imported, 0); assert.equal(store.rows("inventoryMovement").length, 1);
});
test("confirm revalidates tampered combo/service initial stock and foreign warehouses", async (t) => {
  const store = setup(t);
  for (const data of [row({ tipo: "COMBO", stock_inicial: "10" }), row({ tipo: "SERVICIO", stock_inicial: "10" }), row({ tipo: "PRODUCTO", bodega: "FOREIGN" })]) {
    const response = await confirmApi.POST(request([{ data, status: "READY", selectedForImport: true }]));
    assert.equal(response.status, 400);
  }
  assert.equal(store.rows("lightweightProduct").length, 0);
  assert.equal(store.rows("inventoryMovement").length, 0);
});
test("PRODUCT can disable tracking; SERVICE/COMBO invalid boolean stays a validation error", async (t) => {
  setup(t);
  const ctx = await domain.loadProductImportContext("tenant-a");
  for (const tipo of ["SERVICIO", "COMBO"]) {
    assert.equal(domain.processProductImportRows([row({ tipo, controlar_inventario: "maybe" })], ctx).counts.needsReview, 1);
  }
  const preview = domain.processProductImportRows([row({ tipo: "PRODUCTO", controlar_inventario: "false" })], ctx);
  await domain.confirmProductImport("tenant-a", preview.rows, "user-a");
});
test("v2 template endpoint returns a genuine XLSX with the correct columns", async (t) => {
  setup(t);
  const response = await templateApi.GET(new NextRequest("http://localhost/api/inventory/products/import/template?v=2"));
  assert.equal(response.status, 200); assert.match(response.headers.get("content-type")!, /spreadsheetml/);
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const values = workbook.getWorksheet("Productos")!.getRow(1).values;
  assert.deepEqual((values as string[]).slice(1), [...domain.productImportColumns]);
});
