import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL(
  "../../app/api/inventory/products/export/route.ts",
  import.meta.url,
);

const importPath = new URL("./product-import.ts", import.meta.url);
const actionsPath = new URL(
  "../../app/facturacion/products/product-actions-client.tsx",
  import.meta.url,
);

// ── Auth & tenant isolation ─────────────────────────────────────────────────

test("Export endpoint requires auth", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /getCurrentUser/);
  assert.match(source, /AUTH_REQUIRED/);
  assert.match(source, /401/);
});

test("Export scopes to current tenant only", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /getCurrentTenant/);
  assert.match(source, /tenantId: tenant\.id/);
  assert.doesNotMatch(source, /tenantId.*searchParams|searchParams.*tenantId/);
});

// ── Scope handling ──────────────────────────────────────────────────────────

test("Export supports all/filtered/selected scopes", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /scope.*\?\?.*"all"/);
  assert.match(source, /"selected"/);
  assert.match(source, /"filtered"/);
});

test("Selected scope validates ids belong to tenant", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /scope === "selected"/);
  assert.match(source, /in: ids/);
});

test("Filtered scope respects q and type params", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /contains:.*q/);
  assert.match(source, /where\.type.*=.*type/);
});

// ── Column structure ────────────────────────────────────────────────────────

test("Export uses exactly productImportColumns (20 columns)", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /import.*\{.*productImportColumns.*\}.*from/);
  assert.match(source, /addRow\(\[\.\.\.productImportColumns\]\)/);
});

test("productImportColumns has exactly 20 entries", async () => {
  const source = await readFile(importPath, "utf8");
  const match = source.match(/productImportColumns\s*=\s*\[([\s\S]*?)\]\s*as\s*const/);
  assert.ok(match, "productImportColumns not found");
  const entries = match![1].match(/"[^"]+"/g);
  assert.ok(entries);
  assert.equal(entries!.length, 20, `Expected 20 columns, got ${entries!.length}`);
});

test("Column order matches import spec exactly", async () => {
  const source = await readFile(importPath, "utf8");
  const match = source.match(/productImportColumns\s*=\s*\[([\s\S]*?)\]\s*as\s*const/);
  assert.ok(match);
  const entries = match![1].match(/"([^"]+)"/g)!.map((s) => s.replace(/"/g, ""));
  const expected = [
    "tipo", "codigo", "codigo_auxiliar", "codigo_barras", "nombre",
    "descripcion", "categoria", "unidad", "marca", "bodega",
    "costo", "pvp_publico", "pvp_distribuidor", "pvp_mayorista", "pvp_tarjeta",
    "iva", "stock_inicial", "stock_minimo", "controlar_inventario", "activo",
  ];
  assert.deepEqual(entries, expected);
});

// ── Type mapping ────────────────────────────────────────────────────────────

test("PRODUCT maps to PRODUCTO", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /PRODUCT.*PRODUCTO/);
});

test("SERVICE maps to SERVICIO", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /SERVICE.*SERVICIO/);
});

test("COMBO maps to COMBO", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /COMBO.*COMBO/);
});

// ── Stock handling ──────────────────────────────────────────────────────────

test("SERVICE gets stock_inicial=0", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /type.*===.*"PRODUCT".*trackInventory/);
});

test("COMBO gets stock_inicial=0", async () => {
  const source = await readFile(routePath, "utf8");
  const stockBlock = source.match(/stockInicial\s*=\s*0[\s\S]*?if\s*\(p\.type/);
  assert.ok(stockBlock, "Stock initialization block found");
});

test("trackInventory=false gets stock=0", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /p\.type === "PRODUCT" && p\.trackInventory && whId/);
});

test("Uses InventoryStockBalance for warehouse stock", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /stockBalances/);
  assert.match(source, /balance.*warehouseId.*===.*whId/);
});

test("Falls back to legacy product.stock", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /balance.*\?.*Number\(balance\.quantity\).*:.*p\.stock/);
});

// ── XLSX format ─────────────────────────────────────────────────────────────

test("Response content type is xlsx", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
});

test("Filename includes date", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /facturom-productos-.*today/);
});

test("Worksheet named PRODUCTOS", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /addWorksheet\("PRODUCTOS"\)/);
});

test("Has INSTRUCCIONES sheet", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /addWorksheet\("INSTRUCCIONES"\)/);
  assert.match(source, /compatible con Importar productos/);
});

test("Header has blue Facturom style with white text", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /FF1E52F1/);
  assert.match(source, /FFFFFFFF/);
  assert.match(source, /bold: true/);
});

test("Sheet has frozen first row", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /frozen/);
  assert.match(source, /ySplit: 1/);
});

test("Sheet has autofilter", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /autoFilter/);
});

// ── IVA export ──────────────────────────────────────────────────────────────

test("Uses productTaxValue for IVA export", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /productTaxValue/);
  assert.match(source, /NON_OBJECT/);
  assert.match(source, /EXEMPT/);
});

// ── No internal data leak ───────────────────────────────────────────────────

test("Does not export internal IDs", async () => {
  const source = await readFile(routePath, "utf8");
  const rowBlock = source.match(/addRow\(\[([\s\S]*?)\]\)/g);
  assert.ok(rowBlock);
  const dataRow = rowBlock!.find((r) => r.includes("p.name"));
  assert.ok(dataRow);
  assert.doesNotMatch(dataRow!, /p\.id\b/);
  assert.doesNotMatch(dataRow!, /tenantId/);
  assert.doesNotMatch(dataRow!, /createdAt/);
  assert.doesNotMatch(dataRow!, /updatedAt/);
});

// ── Warehouse export ────────────────────────────────────────────────────────

test("Warehouse uses code or name for import compatibility", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /defaultWarehouse\.code.*\|\|.*defaultWarehouse\.name/);
});

// ── UI ──────────────────────────────────────────────────────────────────────

test("Product actions has Exportar button", async () => {
  const source = await readFile(actionsPath, "utf8");
  assert.match(source, />Exportar</);
});

test("Export panel offers all/filtered/selected scopes", async () => {
  const source = await readFile(actionsPath, "utf8");
  assert.match(source, /Todos los productos/);
  assert.match(source, /Productos filtrados/);
  assert.match(source, /Productos seleccionados/);
});

test("Selected option disabled when no products selected", async () => {
  const source = await readFile(actionsPath, "utf8");
  assert.match(source, /disabled=\{selected\.length === 0\}/);
});

// ── Import compatibility ────────────────────────────────────────────────────

test("Export columns match import parseProductTax expectations", async () => {
  const inputSource = await readFile(
    new URL("./inventory-product-input.ts", import.meta.url),
    "utf8",
  );
  assert.match(inputSource, /NON_OBJECT/);
  assert.match(inputSource, /EXEMPT/);

  const routeSource = await readFile(routePath, "utf8");
  assert.match(routeSource, /function exportTaxValue/);
  assert.match(routeSource, /NON_OBJECT/);
  assert.match(routeSource, /EXEMPT/);
});

test("Export type values match import TYPE_MAP expectations", async () => {
  const importSource = await readFile(importPath, "utf8");
  assert.match(importSource, /PRODUCTO.*PRODUCT/);
  assert.match(importSource, /SERVICIO.*SERVICE/);
  assert.match(importSource, /COMBO.*COMBO/);
});

test("Description column has wrap text", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /wrapText: true/);
});

// ── Default warehouse resolution ────────────────────────────────────────────

test("Resolves default warehouse from settings then isDefault", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /inventorySettings\.findUnique/);
  assert.match(source, /isDefault: true/);
});
