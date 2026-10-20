import assert from "node:assert/strict";
import test, { mock, type TestContext } from "node:test";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { treasuryStore } from "./treasury/test-store";
import { PRODUCT_IMPORT_URLS, previewProductImport, confirmProductImportPreview, canConfirmProductImport, toggleProductImportRow } from "../client/product-import";
import type { ProductImportPreviewResult } from "./product-import";

let ui: typeof import("../../app/facturacion/products/product-actions-client");
let template: typeof import("../../app/api/inventory/products/import/template/route");
let preview: typeof import("../../app/api/inventory/products/import/preview/route");
let validate: typeof import("../../app/api/inventory/products/import/validate/route");
let confirm: typeof import("../../app/api/inventory/products/import/confirm/route");
test.before(async () => {
  mock.module(resolve("lib/security/server-only.ts"), { namedExports: {} });
  mock.module("next/navigation", { namedExports: { useRouter: () => ({ push() {}, refresh() {} }) } });
  mock.module(resolve("lib/auth/current-user.ts"), { namedExports: { getCurrentUser: async () => ({ id: "user-a", tenant: { id: "tenant-a" } }) } });
  mock.module(resolve("lib/tenant/current-tenant.ts"), { namedExports: { getCurrentTenant: async () => ({ id: "tenant-a" }) } });
  mock.module(resolve("lib/core/tenant-operational-access.ts"), { namedExports: { requireTenantOperationalAccess: async () => undefined } });
  ui = await import("../../app/facturacion/products/product-actions-client");
  template = await import("../../app/api/inventory/products/import/template/route");
  preview = await import("../../app/api/inventory/products/import/preview/route");
  validate = await import("../../app/api/inventory/products/import/validate/route");
  confirm = await import("../../app/api/inventory/products/import/confirm/route");
});
function setup(t: TestContext) {
  return treasuryStore(t, ["lightweightProduct", "lightweightProductCategory", "inventoryBrand", "inventoryUnit", "inventoryWarehouse", "inventoryMovement", "inventoryStockBalance", "accountingAccount"]);
}
function previewHtml(result: ProductImportPreviewResult) {
  return renderToStaticMarkup(createElement(ui.ProductImportPreview, { preview: result, busy: false, onToggle() {}, onConfirm() {} }));
}
function routeFetch(t: TestContext, calls: string[]) {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    const path = String(url); calls.push(path);
    const request = new NextRequest(`http://localhost${path}`, { ...options, signal: options?.signal ?? undefined });
    if (path === PRODUCT_IMPORT_URLS.preview) return preview.POST(request);
    if (path === PRODUCT_IMPORT_URLS.validate) return validate.POST(request);
    if (path === PRODUCT_IMPORT_URLS.confirm) return confirm.POST(request);
    throw new Error(`Unexpected endpoint: ${path}`);
  });
}
test("the actual Download format link requests V2 and downloads exactly 20 columns with controlar_inventario before activo", async () => {
  const html = renderToStaticMarkup(createElement(ui.ProductActionsClient, { selected: [], q: "", type: "" }));
  const url = html.match(/<a[^>]*href="([^"]+)"[^>]*>Descargar formato<\/a>/)?.[1];
  assert.equal(url, "/api/inventory/products/import/template?v=2");
  const response = await template.GET(new NextRequest(`http://localhost${url}`));
  assert.equal(response.status, 200);
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const columns = (workbook.getWorksheet("Productos")!.getRow(1).values as string[]).slice(1);
  assert.equal(columns.length, 20);
  assert.deepEqual(columns, ["tipo", "codigo", "codigo_auxiliar", "codigo_barras", "nombre", "descripcion", "categoria", "unidad", "marca", "bodega", "costo", "pvp_publico", "pvp_distribuidor", "pvp_mayorista", "pvp_tarjeta", "iva", "stock_inicial", "stock_minimo", "controlar_inventario", "activo"]);
});
test("visible V2 flow previews all rows and issues, excludes invalid combo stock, validates then confirms a non-tracking PRODUCT", async (t) => {
  const store = setup(t); const calls: string[] = []; routeFetch(t, calls);
  const result = await previewProductImport(new File(["tipo,nombre,controlar_inventario,stock_inicial\nPRODUCTO,Producto sin stock,false,0\nSERVICIO,Consulta,true,0\nCOMBO,Combo inválido,true,4"], "products.csv"));
  assert.equal(result.rows[0].status, "READY"); assert.equal(result.rows[2].status, "NEEDS_REVIEW");
  const html = previewHtml(result);
  for (const label of ["Fila", "Tipo", "Código", "Nombre", "IVA", "PVP público", "Stock inicial", "Controlar inventario", "Estado"]) assert.ok(html.includes(label));
  assert.ok(html.includes("Combo inválido")); assert.ok(html.includes("stock_inicial:"));
  assert.match(html, /<button[^>]* disabled=""[^>]*>Confirmar importación<\/button>/);
  assert.equal(canConfirmProductImport(result.rows), false);
  result.rows[2] = toggleProductImportRow(result.rows[2]);
  assert.equal(result.rows[2].status, "EXCLUDED"); assert.equal(result.rows[2].selectedForImport, false);
  assert.equal(canConfirmProductImport(result.rows), true);
  assert.equal(toggleProductImportRow(result.rows[2]).status, "NEEDS_REVIEW");
  let validated: ProductImportPreviewResult | undefined;
  const imported = await confirmProductImportPreview(result.rows, (next) => { validated = next; });
  assert.equal(validated?.rows[2].status, "EXCLUDED"); assert.equal(imported.imported, 2);
  assert.deepEqual(calls, [PRODUCT_IMPORT_URLS.preview, PRODUCT_IMPORT_URLS.validate, PRODUCT_IMPORT_URLS.confirm]);
  const product = store.rows("lightweightProduct").find((p) => p.type === "PRODUCT")!;
  assert.equal(product.name, "Producto sin stock"); assert.equal(product.trackInventory, false);
  assert.equal(store.rows("inventoryMovement").length, 0); assert.equal(store.rows("inventoryStockBalance").length, 0);
});
test("server revalidation errors remain visible and prevent the confirm request", async (t) => {
  setup(t); const calls: string[] = []; routeFetch(t, calls);
  const result = await previewProductImport(new File(["tipo,nombre,stock_inicial\nSERVICIO,Servicio,0"], "products.csv"));
  result.rows[0].data.stock_inicial = "10";
  let validated = result;
  await assert.rejects(confirmProductImportPreview(result.rows, (next) => { validated = next; }), /filas inválidas/);
  assert.equal(validated.rows[0].status, "NEEDS_REVIEW");
  assert.ok(previewHtml(validated).includes("Un servicio no puede tener stock inicial"));
  assert.ok(!calls.includes(PRODUCT_IMPORT_URLS.confirm));
});
test("existing and in-file duplicate rows stay visible and cannot be included", async (t) => {
  const store = setup(t); const calls: string[] = []; routeFetch(t, calls);
  store.seed("lightweightProduct", { primaryCode: "EXISTS" });
  const result = await previewProductImport(new File(["tipo,nombre,codigo\nSERVICIO,Existente,EXISTS\nSERVICIO,Nuevo,DUP\nSERVICIO,Duplicado,DUP"], "products.csv"));
  assert.equal(result.rows[0].status, "SKIP_EXISTING"); assert.equal(result.rows[2].status, "SKIP_DUPLICATE_FILE");
  assert.equal(toggleProductImportRow(result.rows[0]), result.rows[0]);
  const html = previewHtml(result); assert.ok(html.includes("SKIP_EXISTING")); assert.ok(html.includes("SKIP_DUPLICATE_FILE"));
  assert.match(html, /aria-label="Incluir fila 2"[^>]*disabled=""/);
});
