import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/navigation", { namedExports: { useRouter: () => ({ push() {}, refresh() {} }) } });
let ProductActionsClient: typeof import("../../app/facturacion/products/product-actions-client").ProductActionsClient;
test.before(async () => { ({ ProductActionsClient } = await import("../../app/facturacion/products/product-actions-client")); });

test("AA–AF: actions enabled without selection; only barcode disabled and explained", () => {
  const html = renderToStaticMarkup(createElement(ProductActionsClient, { selected: [], q: "", type: "" }));
  for (const label of ["Actualizar precios", "Importar", "Descargar formato", "Combos"]) {
    const button = html.match(new RegExp(`<(?:button|a)[^>]*>${label}</(?:button|a)>`))?.[0];
    assert.ok(button, label); assert.ok(!button.includes(' disabled=""'), label);
  }
  assert.match(html, /<button[^>]* disabled=""[^>]*>Imprimir códigos de barras<\/button>/);
  assert.ok(html.includes("Selecciona al menos un producto."));
});
test("AG: barcode enabled with selected products", () => {
  const html = renderToStaticMarkup(createElement(ProductActionsClient, { selected: ["selected-product"], q: "", type: "" }));
  const barcode = html.match(/<button[^>]*>Imprimir códigos de barras<\/button>/)?.[0];
  assert.ok(barcode); assert.ok(!barcode.includes(' disabled=""'));
});

test("AA: create is always available and visible-row selection has an accessible label", async () => {
  const { ProductsListClient } = await import("../../app/facturacion/products/products-list-client");
  const html = renderToStaticMarkup(createElement(ProductsListClient, { initialProducts: [], initialTotal: 0, q: "", type: "", page: 1 }));
  assert.match(html, /href="\/facturacion\/products\/new"/);
  assert.ok(html.includes("+ Crear producto"));
  assert.ok(html.includes("Seleccionar productos visibles"));
});
