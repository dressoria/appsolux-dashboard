import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { normalizeProductInput, parseProductTax, productPriceCalculation, productTaxLabel, productTaxValue } from "./inventory-product-input";
import { productErrorResponse } from "./inventory-product-errors";
import { createProduct, updateProduct } from "./inventory-products";
import { previewImport, confirmImport } from "./inventory-import";
import { previewBulkPriceUpdate, confirmBulkPriceUpdate } from "./inventory-prices";
import { productImportTemplate, readProductImportFile } from "./inventory-import-file";
import ExcelJS from "exceljs";

const tenantId = "test-inventory-tenant";
let products: Record<string, unknown>[] = [];
let warehouses = [{ id: "warehouse-test", tenantId, name: "Principal", code: "MAIN", active: true, isDefault: true }];
const calls: { model: string; data: Record<string, unknown> }[] = [];
function matches(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return (value as Record<string, unknown>[]).some((w) => matches(record, w));
    if (value && typeof value === "object") {
      if ("not" in value) return record[key] !== value.not;
      if ("in" in value) return (value.in as unknown[]).includes(record[key]);
      if ("contains" in value) return String(record[key] ?? "").toLowerCase().includes(String(value.contains).toLowerCase());
    }
    return String(record[key]) === String(value);
  });
}
const catalog = (rows: Record<string, unknown>[]) => ({
  findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null,
  findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where)),
});
const db: Record<string, unknown> & { $transaction: <T>(operation: (client: typeof db) => Promise<T>) => Promise<T> } = {
  lightweightProduct: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => products.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where }: { where: Record<string, unknown> }) => products.filter((row) => matches(row, where)),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      for (const field of ["primaryCode", "barcode"]) if (data[field] != null && products.some((p) => p.tenantId === data.tenantId && p[field] === data[field])) throw { code: "P2002", meta: { target: ["tenantId", field] } };
      for (const field of ["price", "price2", "price3", "price4", "cost", "taxRate"]) assert.ok(Number.isFinite(Number(data[field])), `${field} must be finite at Prisma boundary`);
      const product = { ...data, id: `test-product-${products.length + 1}` }; products.push(product); calls.push({ model: "product", data }); return product;
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const product = products.find((p) => matches(p, where)); assert.ok(product); Object.assign(product, data); return product;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const rows = products.filter((p) => matches(p, where)); rows.forEach((p) => Object.assign(p, data)); return { count: rows.length };
    },
  },
  lightweightProductCategory: catalog([{ id: "category-test", tenantId, name: "SIN CATEGORÍA" }]),
  inventoryBrand: catalog([{ id: "brand-test", tenantId, name: "SIN MARCA" }]),
  inventoryUnit: catalog([{ id: "unit-test", tenantId, name: "SIN UNIDAD", code: "UNIT" }]),
  inventoryWarehouse: { findFirst: async ({ where }: { where: Record<string, unknown> }) => warehouses.find((w) => matches(w, where)) ?? null, findMany: async () => warehouses },
  accountingAccount: catalog([]),
  inventoryStockBalance: { create: async ({ data }: { data: Record<string, unknown> }) => { calls.push({ model: "balance", data }); } },
  inventoryMovement: { create: async ({ data }: { data: Record<string, unknown> }) => { calls.push({ model: "movement", data }); } },
  productPriceChange: { create: async ({ data }: { data: Record<string, unknown> }) => { calls.push({ model: "priceChange", data }); } },
  $transaction: async <T>(operation: (client: typeof db) => Promise<T>): Promise<T> => {
    const snapshot = products.map((p) => ({ ...p })); const callCount = calls.length;
    try { return await operation(db); } catch (error) { products = snapshot; calls.length = callCount; throw error; }
  },
};
process.env.DATABASE_URL ||= "postgresql://test.invalid/inventory";
(globalThis as unknown as { prisma: PrismaClient }).prisma = db as unknown as PrismaClient;

test.beforeEach(() => { products = []; calls.length = 0; warehouses = [{ id: "warehouse-test", tenantId, name: "Principal", code: "MAIN", active: true, isDefault: true }]; });

test("A–C: three consecutive minimal products persist with blank optional codes", async () => {
  for (let i = 1; i <= 3; i++) await createProduct(tenantId, { name: ` Producto ${i} `, primaryCode: "  ", barcode: "", price: "" });
  assert.equal(products.length, 3);
  for (const p of products) { assert.equal(p.primaryCode, null); assert.equal(p.barcode, null); assert.equal(p.price, 0); assert.equal(p.defaultWarehouseId, "warehouse-test"); }
});

test("D/E/X: empty monetary inputs become zero; card price persists", async () => {
  const p = await createProduct(tenantId, { name: "Producto", price: "", cost: " ", price2: null, price3: undefined, price4: "8.40" });
  assert.equal(Number(p.cost), 0); assert.equal(Number(p.price), 0); assert.equal(Number(p.price2), 0); assert.equal(Number(p.price3), 0); assert.equal(Number(p.price4), 8.4);
});

for (const field of ["cost", "price", "price2", "price3", "price4"]) for (const value of [-1, -0.01, "abc", Infinity, NaN]) {
  test(`F/G/Z: rejects ${field}=${value} before Prisma`, async () => {
    await assert.rejects(createProduct(tenantId, { name: "Invalid", [field]: value })); assert.equal(calls.length, 0);
  });
}
for (const field of ["primaryCode", "barcode"]) test(`H/I: tenant duplicate ${field} maps to HTTP 409`, async () => {
  await createProduct(tenantId, { name: "One", [field]: " UNIQUE " });
  await assert.rejects(createProduct(tenantId, { name: "Two", [field]: "UNIQUE" }), (e) => {
    const result = productErrorResponse(e); assert.equal(result.status, 409); assert.equal(result.body.field, field); return true;
  });
  await createProduct("another-tenant", { name: "Other tenant", type: "SERVICE", [field]: "UNIQUE" });
});
test("P2002 race maps both unique indexes to structured HTTP 409", () => {
  for (const field of ["primaryCode", "barcode"]) {
    const result = productErrorResponse({ code: "P2002", meta: { target: ["tenantId", field] } });
    assert.equal(result.status, 409); assert.equal(result.body.field, field);
  }
});
test("J: service works without warehouse or inventory account", async () => {
  warehouses = [];
  const p = await createProduct(tenantId, { name: "Servicio", type: "SERVICE", trackInventory: true });
  assert.equal(p.trackInventory, false); assert.equal(p.defaultWarehouseId, null); assert.equal(p.inventoryAccountId, null);
});
test("K: inventoriable uses tenant default and missing warehouse returns actionable 400", async () => {
  const p = await createProduct(tenantId, { name: "Stock" }); assert.equal(p.defaultWarehouseId, "warehouse-test");
  warehouses = [];
  await assert.rejects(createProduct(tenantId, { name: "No warehouse" }), /Configura una bodega predeterminada/);
});
test("L/Y: editing preserves secondary prices and strips tenant/stock injection", async () => {
  const p = await createProduct(tenantId, { name: "Original", price: 6.09, price2: 4, price3: 3, price4: 7, taxRate: 15 });
  const edited = await updateProduct(tenantId, p.id, { name: " Editado ", tenantId: "attack", stock: 999 });
  assert.equal(edited.name, "Editado"); assert.equal(edited.tenantId, tenantId); assert.equal(edited.stock, undefined);
  assert.equal(Number(edited.price2), 4); assert.equal(Number(edited.price3), 3); assert.equal(Number(edited.price4), 7);
  await assert.rejects(updateProduct("another-tenant", p.id, { name: "No" }), /no encontrado/);
});
for (const [input, taxCategory, taxRate] of [[15,"TAXABLE",15],[5,"TAXABLE",5],[8,"TAXABLE",8],[12,"TAXABLE",12],[0,"ZERO",0],["NO_OBJETO","NON_OBJECT",0],["EXENTO","EXEMPT",0]] as const) {
  test(`M–S: ${input} maps to ${taxCategory}/${taxRate}`, () => assert.deepEqual(parseProductTax(input), { taxCategory, taxRate }));
}
for (const invalid of [13,"13%",20,"7.5",100,"libre", {}, "abc"]) test(`T/U: rejects IVA ${String(invalid)}`, () => assert.throws(() => parseProductTax(invalid)));
test("tax pairing is enforced and historical null categories display correctly", () => {
  assert.throws(() => normalizeProductInput({ name: "Bad", taxCategory: "ZERO", taxRate: 15 }));
  assert.throws(() => normalizeProductInput({ name: "Bad", taxCategory: "EXEMPT", taxRate: 15 }));
  assert.equal(productTaxValue(null, 0), "0"); assert.equal(productTaxValue(null, 15), "15");
  assert.equal(productTaxLabel("NON_OBJECT", 0), "No objeto"); assert.equal(productTaxLabel("EXEMPT", 0), "Exento");
});
test("K fixtures: BLOOM 6.09/15%; UROCAPS and URO OVULOS 0% load and edit", async () => {
  for (const [name, taxRate] of [["BLOOM",15],["UROCAPS",0],["URO OVULOS",0]] as const) {
    const p = await createProduct(tenantId, { name, taxRate, price: name === "BLOOM" ? 6.09 : 1 });
    const edited = await updateProduct(tenantId, p.id, { name });
    assert.equal(Number(edited.taxRate), taxRate); assert.equal(productTaxValue(edited.taxCategory, edited.taxRate), String(taxRate));
    if (name === "BLOOM") assert.equal(Number(edited.price), 6.09);
  }
});
test("V/W: gains and zero-cost margin; net PVP receives IVA once", () => {
  assert.deepEqual(productPriceCalculation(10, 5, 15), { gain: 5, margin: 100, withTax: 11.5 });
  assert.equal(productPriceCalculation(10, 0, 0).margin, 0);
});

test("AH: downloadable XLSX is real, contains all 19 columns and tax documentation", async () => {
  const buffer = await productImportTemplate(); assert.equal(Buffer.from(buffer).subarray(0,2).toString(), "PK");
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  assert.equal(book.worksheets[0].getRow(1).cellCount, 19); assert.ok(book.getWorksheet("Instrucciones"));
  assert.ok(book.worksheets[0].getCell("P2").dataValidation.formulae?.[0].includes("EXEMPT"));
});
test("CSV preserves leading zero codes and quoted commas; XLSX round-trip", async () => {
  const rows = await readProductImportFile(new File(['codigo,nombre,iva,pvp_publico\n00123,"Producto, uno",15%,6.09'], "products.csv"));
  assert.equal(rows[0].codigo, "00123"); assert.equal(rows[0].nombre, "Producto, uno");
  const book = new ExcelJS.Workbook(); book.addWorksheet("Productos").addRows([["nombre","iva"],["Dos","EXEMPT"]]);
  const xlsxRows = await readProductImportFile(new File([new Uint8Array(await book.xlsx.writeBuffer())], "products.xlsx"));
  assert.equal(xlsxRows[0].iva, "EXEMPT");
});
test("AI: preview validates without persistence", async () => {
  const result = await previewImport(tenantId, [{ nombre: "Importado", iva: "12%" }]);
  assert.equal(result.valid.length, 1); assert.equal(products.length, 0); assert.equal(calls.length, 0);
});
test("AJ/AK: invalid IVA, negative price, unknown catalogs and in-file duplicates show row errors", async () => {
  const result = await previewImport(tenantId, [
    { nombre: "Bad tax", iva: 13 }, { nombre: "Bad price", pvp_tarjeta: -0.01 },
    ...["categoria","unidad","marca","bodega"].map((field) => ({ nombre: field, [field]: "unknown" })),
    { nombre: "One", codigo: "DUP", codigo_barras: "DUPB" }, { nombre: "Two", codigo: "DUP", codigo_barras: "DUPB" },
  ]);
  assert.ok(result.errors.some((e) => e.row === 2 && e.field === "iva"));
  assert.ok(result.errors.some((e) => e.row === 3 && e.field === "pvp_tarjeta"));
  for (const field of ["categoria","unidad","marca","bodega"]) assert.ok(result.errors.some((e) => e.field === field));
  assert.equal(result.duplicates.length, 2); assert.equal(products.length, 0);
});
test("AL: confirm saves all prices, tax category, unit/warehouse, opening balance and movement", async () => {
  const result = await confirmImport(tenantId, [{ nombre: "Importado", iva: "NO_OBJETO", unidad: "UNIT", bodega: "MAIN", pvp_tarjeta: 7.25, stock_inicial: 3 }], "test-user");
  assert.equal(result.created, 1); assert.equal(products[0].taxCategory, "NON_OBJECT"); assert.equal(products[0].price4, 7.25);
  assert.equal(products[0].unitId, "unit-test"); assert.equal(products[0].stock, 3);
  assert.equal(calls.filter((c) => c.model === "movement").length, 1); assert.equal(calls.filter((c) => c.model === "balance").length, 1);
});
test("confirm revalidates tampered rows and preview/confirm duplicate races atomically", async () => {
  await assert.rejects(confirmImport(tenantId, [{ nombre: "Bad", pvp_publico: -1 }], "test-user")); assert.equal(products.length, 0);
  await previewImport(tenantId, [{ nombre: "One", codigo: "RACE" }]);
  await createProduct(tenantId, { name: "Concurrent", primaryCode: "RACE" });
  await assert.rejects(confirmImport(tenantId, [{ nombre: "One", codigo: "RACE" }], "test-user")); assert.equal(products.length, 1);
});
test("bulk pricing filters tenant, previews card prices and logs actual changes; stale preview rejected", async () => {
  const p = await createProduct(tenantId, { name: "Bulk", price4: 10 });
  const preview = await previewBulkPriceUpdate(tenantId, [p.id], "price4", "increase_percent", 10);
  assert.equal(preview[0].newPrice, "11.00"); assert.equal(Number(products[0].price4), 10);
  await confirmBulkPriceUpdate(tenantId, preview.map((c) => ({ ...c, productId: c.id })), "price4", "Test", "test-user");
  assert.equal(Number(products[0].price4), 11); assert.equal(calls.filter((c) => c.model === "priceChange").length, 1);
  await assert.rejects(confirmBulkPriceUpdate(tenantId, preview.map((c) => ({ ...c, productId: c.id })), "price4", undefined, "test-user"), /cambió/);
});
test("bulk invalid channel/value and negative confirmation fail before writes", async () => {
  await assert.rejects(previewBulkPriceUpdate(tenantId, [], "tenantId" as never, "increase_value", 1));
  await assert.rejects(previewBulkPriceUpdate(tenantId, [], "price", "increase_value", NaN));
  await assert.rejects(confirmBulkPriceUpdate(tenantId, [{ productId: "x", oldPrice: "0", newPrice: "-1" }], "price", undefined, "test-user"));
  assert.equal(calls.length, 0);
});

test("POST/PATCH HTTP contract: three creates, duplicate 409, invalid 400, update 200", async (context) => {
  const { resolve } = await import("node:path");
  context.mock.module(resolve("lib/auth/current-user.ts"), { namedExports: { getCurrentUser: async () => ({ id: "test-user", tenant: { id: tenantId } }) } });
  context.mock.module(resolve("lib/tenant/current-tenant.ts"), { namedExports: { getCurrentTenant: async () => ({ id: tenantId }) } });
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../../app/api/inventory/products/route");
  const { PATCH } = await import("../../app/api/inventory/products/[productId]/route");
  const request = (body: unknown, method = "POST") => new NextRequest("http://localhost/api/inventory/products", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  let id = "";
  for (let i = 1; i <= 3; i++) {
    const response = await POST(request({ name: `HTTP ${i}`, primaryCode: "", barcode: "", cost: "", price: "" }));
    assert.equal(response.status, 201); id = (await response.json()).id;
  }
  assert.equal(products.length, 3);
  const invalid = await POST(request({ name: "Negative", price4: -1 }));
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).field, "price4");
  await POST(request({ name: "Code", primaryCode: "DUPLICATE" }));
  const duplicate = await POST(request({ name: "Again", primaryCode: "DUPLICATE" }));
  assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).code, "DUPLICATE_PRODUCT");
  await POST(request({ name: "Barcode", barcode: "BARCODE" }));
  assert.equal((await POST(request({ name: "Again", barcode: "BARCODE" }))).status, 409);
  const edited = await PATCH(request({ price4: "7.25", name: "Edited" }, "PATCH"), { params: Promise.resolve({ productId: id }) });
  assert.equal(edited.status, 200); assert.equal(Number((await edited.json()).price4), 7.25);
  const invalidPatch = await PATCH(request({ price: -1 }, "PATCH"), { params: Promise.resolve({ productId: id }) });
  assert.equal(invalidPatch.status, 400);
  const malformed = await POST(new NextRequest("http://localhost/api/inventory/products", { method: "POST", body: "{invalid" }));
  assert.equal(malformed.status, 400);
  const { GET: template } = await import("../../app/api/inventory/products/import/template/route");
  const format = await template(new NextRequest("http://localhost/api/inventory/products/import/template"));
  assert.equal(format.status, 200); assert.match(format.headers.get("content-type")!, /spreadsheetml/);
  assert.equal(Buffer.from(await format.arrayBuffer()).subarray(0,2).toString(), "PK");
  const { POST: importRows } = await import("../../app/api/inventory/products/import/route");
  const file = new FormData(); file.append("file", new File(["nombre,iva,pvp_publico\nDesde CSV,15%,6.09"], "products.csv"));
  const before = products.length;
  const importPreview = await importRows(new NextRequest("http://localhost/api/inventory/products/import", { method: "POST", body: file }));
  assert.equal(importPreview.status, 200); assert.equal(products.length, before);
  const parsed = await importPreview.json(); assert.equal(parsed.valid.length, 1);
  const confirmed = await importRows(request({ action: "confirm", rows: parsed.rows }));
  assert.equal(confirmed.status, 200); assert.equal(products.length, before + 1);
  assert.equal((await importRows(request(null))).status, 400);
  const { POST: updatePrices } = await import("../../app/api/inventory/products/update-prices/route");
  assert.equal((await updatePrices(request(null))).status, 400);
  assert.equal((await POST(request(null))).status, 400);

});

test("barcode PDF includes only selected tenant products; missing selection/code rejected", async () => {
  const { productBarcodePdf } = await import("./inventory-barcodes");
  const one = await createProduct(tenantId, { name: "Selected", primaryCode: "0012345678" });
  await createProduct(tenantId, { name: "Unselected", barcode: "9999999" });
  const pdf = await productBarcodePdf(tenantId, [one.id]);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const { PDFDocument } = await import("pdf-lib");
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
  await assert.rejects(productBarcodePdf(tenantId, []));
  await assert.rejects(productBarcodePdf("another-tenant", [one.id]));
  const blank = await createProduct(tenantId, { name: "No code" });
  await assert.rejects(productBarcodePdf(tenantId, [blank.id]), /Asigna un código/);
});

test("three distinct SKUs with blank barcodes can be created consecutively", async () => {
  for (const code of ["SKU-1", "SKU-2", "SKU-3"]) await createProduct(tenantId, { name: code, primaryCode: code, barcode: "" });
  assert.equal(products.length, 3); assert.ok(products.every((p) => p.barcode === null));
});
test("bulk empty price normalizes to zero and actual public-price filter never compares null", async () => {
  const p = await createProduct(tenantId, { name: "Zero", price: 0 });
  await confirmBulkPriceUpdate(tenantId, [{ productId: p.id, oldPrice: "0", newPrice: "" }], "price", undefined, "test-user");
  assert.equal(Number(products[0].price), 0);
});
