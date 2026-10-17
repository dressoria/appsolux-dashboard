import assert from "node:assert/strict";
import test from "node:test";

import { processProductImportRows, resolveTrackInventory, type ProductImportRow } from "./product-import";
type ImportContext = Parameters<typeof processProductImportRows>[1];

function emptyRow(overrides: Partial<ProductImportRow> = {}): ProductImportRow {
  return {
    tipo: "", codigo: "", codigo_auxiliar: "", codigo_barras: "",
    nombre: "", descripcion: "", categoria: "", unidad: "",
    marca: "", bodega: "", costo: "", pvp_publico: "",
    pvp_distribuidor: "", pvp_mayorista: "", pvp_tarjeta: "",
    iva: "", stock_inicial: "", stock_minimo: "",
    controlar_inventario: "", activo: "",
    ...overrides,
  };
}

function defaultCtx(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    existingCodes: new Set(),
    existingBarcodes: new Set(),
    categories: [{ id: "cat1", name: "Alimentos" }],
    brands: [{ id: "br1", name: "MarcaX" }],
    units: [{ id: "un1", name: "Unidad" }],
    warehouses: [{ id: "wh1", name: "Principal", isDefault: true }],
    ...overrides,
  };
}

test("I-AJ — valid product row gets READY status", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Arroz", tipo: "PRODUCTO", pvp_publico: "1.50" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "READY");
  assert.equal(result.counts.ready, 1);
});

test("I-AK — missing nombre produces NEEDS_REVIEW", () => {
  const result = processProductImportRows(
    [emptyRow({ tipo: "PRODUCTO" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "nombre"));
});

test("I-AL — invalid tipo produces NEEDS_REVIEW", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "INVALIDO" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "tipo"));
});

test("I-AM — negative price produces issue", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", pvp_publico: "-5" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "pvp_publico"));
});

test("I-AN — existing code marks SKIP_EXISTING", () => {
  const ctx = defaultCtx({ existingCodes: new Set(["ABC123"]) });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", codigo: "ABC123" })],
    ctx,
  );
  assert.equal(result.rows[0].status, "SKIP_EXISTING");
  assert.equal(result.counts.skipExisting, 1);
});

test("I-AO — duplicate code within file marks SKIP_DUPLICATE_FILE", () => {
  const result = processProductImportRows(
    [
      emptyRow({ nombre: "A", tipo: "PRODUCTO", codigo: "DUP1" }),
      emptyRow({ nombre: "B", tipo: "PRODUCTO", codigo: "DUP1" }),
    ],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "READY");
  assert.equal(result.rows[1].status, "SKIP_DUPLICATE_FILE");
});

test("I-AP — service type with stock_inicial produces issue", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Consulta", tipo: "SERVICIO", stock_inicial: "10" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "stock_inicial"));
});

test("I-AQ — empty tipo defaults to PRODUCTO", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Sin tipo" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].data.tipo, "PRODUCTO");
  assert.ok(result.rows[0].autofilledFields.includes("tipo"));
});

test("I-AR — empty iva defaults to 15", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].data.iva, "15");
  assert.ok(result.rows[0].autofilledFields.includes("iva"));
});

test("I-AS — unknown category produces issue", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", categoria: "NoExiste" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "categoria"));
});

test("I-AT — controlar_inventario false is valid", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", controlar_inventario: "false" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "READY");
  assert.equal(result.rows[0].data.controlar_inventario, "false");
});

test("I-AU — invalid controlar_inventario value produces issue", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", controlar_inventario: "maybe" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "controlar_inventario"));
});

test("I-AV — no default warehouse and no bodega produces issue for PRODUCT", () => {
  const ctx = defaultCtx({ warehouses: [{ id: "wh1", name: "Sucursal", isDefault: false }] });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO" })],
    ctx,
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "bodega"));
});

test("I-AW — service does NOT need warehouse", () => {
  const ctx = defaultCtx({ warehouses: [] });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Servicio", tipo: "SERVICIO" })],
    ctx,
  );
  assert.equal(result.rows[0].status, "READY");
});

test("I-AX — counts are correct for mixed rows", () => {
  const ctx = defaultCtx({ existingCodes: new Set(["OLD1"]) });
  const result = processProductImportRows(
    [
      emptyRow({ nombre: "Good", tipo: "PRODUCTO" }),
      emptyRow({ nombre: "", tipo: "PRODUCTO" }),
      emptyRow({ nombre: "Dup", tipo: "PRODUCTO", codigo: "OLD1" }),
      emptyRow({ nombre: "A", tipo: "PRODUCTO", codigo: "X1" }),
      emptyRow({ nombre: "B", tipo: "PRODUCTO", codigo: "X1" }),
    ],
    ctx,
  );
  assert.equal(result.counts.ready, 2);
  assert.equal(result.counts.needsReview, 1);
  assert.equal(result.counts.skipExisting, 1);
  assert.equal(result.counts.skipDuplicateFile, 1);
});

// ─── I-AY: COMBO trackInventory ─────────────────────────────────────

test("I-AZ — COMBO forces trackInventory=false", () => {
  assert.equal(resolveTrackInventory("COMBO", ""), false);
  assert.equal(resolveTrackInventory("COMBO", "true"), false);
  assert.equal(resolveTrackInventory("COMBO", "SI"), false);
  assert.equal(resolveTrackInventory("COMBO", "1"), false);
});

test("I-BA — SERVICE forces trackInventory=false", () => {
  assert.equal(resolveTrackInventory("SERVICE", ""), false);
  assert.equal(resolveTrackInventory("SERVICE", "true"), false);
});

test("I-BB — PRODUCT defaults to trackInventory=true", () => {
  assert.equal(resolveTrackInventory("PRODUCT", ""), true);
  assert.equal(resolveTrackInventory("PRODUCT", "false"), false);
  assert.equal(resolveTrackInventory("PRODUCT", "SI"), true);
});

test("I-BC — COMBO with controlar_inventario=SI normalizes to false", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Mi Combo", tipo: "COMBO", controlar_inventario: "SI" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].data.controlar_inventario, "false");
  assert.ok(result.rows[0].autofilledFields.includes("controlar_inventario"));
});

test("I-BD — COMBO with stock_inicial > 0 produces issue", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Combo Test", tipo: "COMBO", stock_inicial: "10" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "stock_inicial"));
});

test("I-BE — COMBO with stock_inicial = 0 is READY", () => {
  const result = processProductImportRows(
    [emptyRow({ nombre: "Combo OK", tipo: "COMBO", stock_inicial: "0" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "READY");
});

test("I-BF — COMBO does not require warehouse", () => {
  const ctx = defaultCtx({ warehouses: [] });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Combo Sin Bodega", tipo: "COMBO" })],
    ctx,
  );
  assert.equal(result.rows[0].issues.filter((i) => i.field === "bodega").length, 0);
});

test("v2 XLSX instructions enforce virtual combos and CSV/XLSX preserve text codes", async () => {
  const { productImportTemplateV2, readProductImportFileV2 } = await import("./inventory-import-file");
  const { productImportColumns } = await import("./product-import");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await productImportTemplateV2());
  const help = workbook.getWorksheet("Instrucciones")!.getRow(6).getCell(2).text;
  assert.match(help, /COMBO: siempre false/); assert.doesNotMatch(help, /opcional/);
  const sheet = workbook.getWorksheet("Productos")!;
  assert.equal(sheet.columnCount, productImportColumns.length);
  sheet.addRow([]);
  sheet.getCell(2, 1).value = "COMBO";
  sheet.getCell(2, 2).value = "0000123";
  sheet.getCell(2, 5).value = "Mi combo";
  const buffer = await workbook.xlsx.writeBuffer();
  const xlsxRows = await readProductImportFileV2(new File([new Uint8Array(buffer)], "products.xlsx"));
  const csvRows = await readProductImportFileV2(new File(["tipo,codigo,nombre\nCOMBO,0000123,Mi combo"], "products.csv"));
  assert.equal(xlsxRows[0].codigo, "0000123");
  assert.deepEqual(xlsxRows[0], csvRows[0]);
});
