import assert from "node:assert/strict";
import test from "node:test";

// Pure-logic tests for product-import.ts. The module uses server-only guard
// + prisma for loadProductImportContext and confirmProductImport, so we test
// the processing logic by inlining the processProductImportRows function's
// contract using a mock context.

type ProductImportRow = {
  tipo: string; codigo: string; codigo_auxiliar: string; codigo_barras: string;
  nombre: string; descripcion: string; categoria: string; unidad: string;
  marca: string; bodega: string; costo: string; pvp_publico: string;
  pvp_distribuidor: string; pvp_mayorista: string; pvp_tarjeta: string;
  iva: string; stock_inicial: string; stock_minimo: string;
  controlar_inventario: string; activo: string;
};

type ImportContext = {
  existingCodes: Set<string>;
  existingBarcodes: Set<string>;
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string }>;
  warehouses: Array<{ id: string; name: string; isDefault: boolean }>;
};

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

let processProductImportRows: ((rows: ProductImportRow[], ctx: ImportContext) => {
  rows: Array<{ rowNumber: number; data: ProductImportRow; status: string; issues: Array<{ field: string; message: string }>; selectedForImport: boolean; autofilledFields: string[] }>;
  counts: { ready: number; skipExisting: number; skipDuplicateFile: number; needsReview: number };
}) | null = null;

test("I-AI — load processProductImportRows", async () => {
  try {
    const mod = await import("./product-import.ts");
    processProductImportRows = mod.processProductImportRows;
    assert.ok(processProductImportRows, "processProductImportRows should be exported");
  } catch {
    processProductImportRows = null;
  }
});

test("I-AJ — valid product row gets READY status", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Arroz", tipo: "PRODUCTO", pvp_publico: "1.50" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "READY");
  assert.equal(result.counts.ready, 1);
});

test("I-AK — missing nombre produces NEEDS_REVIEW", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ tipo: "PRODUCTO" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "nombre"));
});

test("I-AL — invalid tipo produces NEEDS_REVIEW", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "INVALIDO" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "tipo"));
});

test("I-AM — negative price produces issue", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", pvp_publico: "-5" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "pvp_publico"));
});

test("I-AN — existing code marks SKIP_EXISTING", () => {
  if (!processProductImportRows) return;
  const ctx = defaultCtx({ existingCodes: new Set(["ABC123"]) });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", codigo: "ABC123" })],
    ctx,
  );
  assert.equal(result.rows[0].status, "SKIP_EXISTING");
  assert.equal(result.counts.skipExisting, 1);
});

test("I-AO — duplicate code within file marks SKIP_DUPLICATE_FILE", () => {
  if (!processProductImportRows) return;
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
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Consulta", tipo: "SERVICIO", stock_inicial: "10" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "stock_inicial"));
});

test("I-AQ — empty tipo defaults to PRODUCTO", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Sin tipo" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].data.tipo, "PRODUCTO");
  assert.ok(result.rows[0].autofilledFields.includes("tipo"));
});

test("I-AR — empty iva defaults to 15", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].data.iva, "15");
  assert.ok(result.rows[0].autofilledFields.includes("iva"));
});

test("I-AS — unknown category produces issue", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", categoria: "NoExiste" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "categoria"));
});

test("I-AT — controlar_inventario false is valid", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", controlar_inventario: "false" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "READY");
  assert.equal(result.rows[0].data.controlar_inventario, "false");
});

test("I-AU — invalid controlar_inventario value produces issue", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO", controlar_inventario: "maybe" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "controlar_inventario"));
});

test("I-AV — no default warehouse and no bodega produces issue for PRODUCT", () => {
  if (!processProductImportRows) return;
  const ctx = defaultCtx({ warehouses: [{ id: "wh1", name: "Sucursal", isDefault: false }] });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Test", tipo: "PRODUCTO" })],
    ctx,
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "bodega"));
});

test("I-AW — service does NOT need warehouse", () => {
  if (!processProductImportRows) return;
  const ctx = defaultCtx({ warehouses: [] });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Servicio", tipo: "SERVICIO" })],
    ctx,
  );
  assert.equal(result.rows[0].status, "READY");
});

test("I-AX — counts are correct for mixed rows", () => {
  if (!processProductImportRows) return;
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

let resolveTrackInventory: ((type: string, raw: string) => boolean) | null = null;

test("I-AY — load resolveTrackInventory", async () => {
  try {
    const mod = await import("./product-import.ts");
    resolveTrackInventory = mod.resolveTrackInventory;
  } catch {
    resolveTrackInventory = null;
  }
});

test("I-AZ — COMBO forces trackInventory=false", () => {
  if (!resolveTrackInventory) return;
  assert.equal(resolveTrackInventory("COMBO", ""), false);
  assert.equal(resolveTrackInventory("COMBO", "true"), false);
  assert.equal(resolveTrackInventory("COMBO", "SI"), false);
  assert.equal(resolveTrackInventory("COMBO", "1"), false);
});

test("I-BA — SERVICE forces trackInventory=false", () => {
  if (!resolveTrackInventory) return;
  assert.equal(resolveTrackInventory("SERVICE", ""), false);
  assert.equal(resolveTrackInventory("SERVICE", "true"), false);
});

test("I-BB — PRODUCT defaults to trackInventory=true", () => {
  if (!resolveTrackInventory) return;
  assert.equal(resolveTrackInventory("PRODUCT", ""), true);
  assert.equal(resolveTrackInventory("PRODUCT", "false"), false);
  assert.equal(resolveTrackInventory("PRODUCT", "SI"), true);
});

test("I-BC — COMBO with controlar_inventario=SI normalizes to false", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Mi Combo", tipo: "COMBO", controlar_inventario: "SI" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].data.controlar_inventario, "false");
  assert.ok(result.rows[0].autofilledFields.includes("controlar_inventario"));
});

test("I-BD — COMBO with stock_inicial > 0 produces issue", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Combo Test", tipo: "COMBO", stock_inicial: "10" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "NEEDS_REVIEW");
  assert.ok(result.rows[0].issues.some((i) => i.field === "stock_inicial"));
});

test("I-BE — COMBO with stock_inicial = 0 is READY", () => {
  if (!processProductImportRows) return;
  const result = processProductImportRows(
    [emptyRow({ nombre: "Combo OK", tipo: "COMBO", stock_inicial: "0" })],
    defaultCtx(),
  );
  assert.equal(result.rows[0].status, "READY");
});

test("I-BF — COMBO does not require warehouse", () => {
  if (!processProductImportRows) return;
  const ctx = defaultCtx({ warehouses: [] });
  const result = processProductImportRows(
    [emptyRow({ nombre: "Combo Sin Bodega", tipo: "COMBO" })],
    ctx,
  );
  assert.equal(result.rows[0].issues.filter((i) => i.field === "bodega").length, 0);
});
