import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { createProduct } from "./inventory-products";
import { normalizeProductInput, parseProductTax, productNumber, ProductInputError } from "./inventory-product-input";

export type ImportRow = Record<string, unknown> & { nombre: string };
export const TEMPLATE_COLUMNS = [
  "tipo", "codigo", "codigo_auxiliar", "codigo_barras", "nombre", "descripcion",
  "categoria", "unidad", "marca", "bodega", "costo", "pvp_publico", "pvp_distribuidor",
  "pvp_mayorista", "pvp_tarjeta", "iva", "stock_inicial", "stock_minimo", "activo",
] as const;
export type ImportPreviewResult = {
  valid: ImportRow[];
  errors: Array<{ row: number; field: string; message: string }>;
  duplicates: Array<{ row: number; field: string; value: string }>;
};
const moneyFields = { costo: "cost", pvp_publico: "price", pvp_distribuidor: "price2", pvp_mayorista: "price3", pvp_tarjeta: "price4" } as const;
type ImportDb = Pick<Prisma.TransactionClient, "lightweightProduct" | "lightweightProductCategory" | "inventoryBrand" | "inventoryUnit" | "inventoryWarehouse">;

async function importContext(tenantId: string, db: ImportDb) {
  const [products, categories, brands, units, warehouses] = await Promise.all([
    db.lightweightProduct.findMany({ where: { tenantId }, select: { primaryCode: true, barcode: true } }),
    db.lightweightProductCategory.findMany({ where: { tenantId } }),
    db.inventoryBrand.findMany({ where: { tenantId } }),
    db.inventoryUnit.findMany({ where: { tenantId } }),
    db.inventoryWarehouse.findMany({ where: { tenantId, active: true } }),
  ]);
  return { products, categories, brands, units, warehouses };
}

function rowPayload(row: ImportRow, ctx: Awaited<ReturnType<typeof importContext>>) {
  const typeMap: Record<string, string> = { PRODUCTO: "PRODUCT", SERVICIO: "SERVICE", COMBO: "COMBO", PRODUCT: "PRODUCT", SERVICE: "SERVICE" };
  const type = typeMap[String(row.tipo || "PRODUCTO").trim().toUpperCase()];
  if (!type) throw new ProductInputError("Tipo de producto inválido.", "tipo");
  const active = String(row.activo ?? "true").trim().toLowerCase();
  if (!["true", "false", "1", "0", "si", "sí", "no", ""].includes(active)) throw new ProductInputError("Estado activo inválido.", "activo");
  const ids: Record<string, string | undefined> = {};
  for (const [field, key, catalog] of [
    ["categoria", "categoryId", ctx.categories], ["marca", "brandId", ctx.brands],
    ["unidad", "unitId", ctx.units], ["bodega", "defaultWarehouseId", ctx.warehouses],
  ] as const) {
    const value = String(row[field] ?? "").trim();
    if (!value) continue;
    const record = catalog.find((item) => item.name.toLowerCase() === value.toLowerCase() || ("code" in item && String(item.code).toLowerCase() === value.toLowerCase()));
    if (!record) throw new ProductInputError(`${field} desconocida.`, field);
    ids[key] = record.id;
  }
  if (type !== "SERVICE" && !ids.defaultWarehouseId) {
    ids.defaultWarehouseId = ctx.warehouses.find((w) => w.isDefault)?.id;
    if (!ids.defaultWarehouseId) throw new ProductInputError("Configura una bodega predeterminada antes de crear productos con inventario.", "bodega");
  }
  const stock = productNumber(row.stock_inicial, "stock_inicial", true);
  if (type === "SERVICE" && stock !== 0) throw new ProductInputError("Un servicio no puede tener stock inicial.", "stock_inicial");
  const tax = parseProductTax(row.iva);
  return { data: normalizeProductInput({ name: row.nombre, type, primaryCode: row.codigo, barcode: row.codigo_barras,
    auxiliaryCode: row.codigo_auxiliar, description: row.descripcion, ...ids,
    ...Object.fromEntries(Object.entries(moneyFields).map(([column, field]) => [field, row[column]])),
    ...tax, minStock: row.stock_minimo, isActive: !["false", "0", "no"].includes(active),
  }), stock };
}

export async function previewImport(tenantId: string, rows: ImportRow[], db: ImportDb = getPrismaClient()): Promise<ImportPreviewResult> {
  if (rows.length === 0 || rows.length > 2000) throw new ProductInputError("Importa entre 1 y 2000 filas.");
  const ctx = await importContext(tenantId, db);
  const result: ImportPreviewResult = { valid: [], errors: [], duplicates: [] };
  const codes = new Set(ctx.products.map((p) => p.primaryCode).filter(Boolean));
  const barcodes = new Set(ctx.products.map((p) => p.barcode).filter(Boolean));
  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2; // Header occupies spreadsheet row 1.
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      result.errors.push({ row: rowNumber, field: "fila", message: "Fila inválida." }); continue;
    }
    const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as ImportRow;
    let failed = false;
    for (const [field, seen] of [["codigo", codes], ["codigo_barras", barcodes]] as const) {
      const value = String(row[field] ?? "").trim();
      if (value && seen.has(value)) { result.duplicates.push({ row: rowNumber, field, value }); failed = true; }
      if (value) seen.add(value);
    }
    // Report each invalid monetary column, even when other columns also fail.
    for (const field of Object.keys(moneyFields)) {
      try { productNumber(row[field], field); } catch (error) {
        result.errors.push({ row: rowNumber, field, message: (error as Error).message }); failed = true;
      }
    }
    try { rowPayload(row, ctx); } catch (error) {
      const field = error instanceof ProductInputError ? error.field ?? "fila" : "fila";
      const column = Object.entries(moneyFields).find(([, key]) => key === field)?.[0] ?? (field === "taxRate" ? "iva" : field);
      if (!result.errors.some((e) => e.row === rowNumber && e.field === column)) result.errors.push({ row: rowNumber, field: column, message: (error as Error).message });
      failed = true;
    }
    if (!failed) result.valid.push(row);
  }
  return result;
}

export async function confirmImport(tenantId: string, rows: ImportRow[], userId: string) {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    // Confirmation independently validates current tenant data; preview is never trusted.
    const preview = await previewImport(tenantId, rows, tx);
    if (preview.errors.length || preview.duplicates.length) throw new ProductInputError("La importación contiene errores. Revisa la vista previa.", "rows");
    const ctx = await importContext(tenantId, tx);
    for (const row of preview.valid) {
      const { data, stock } = rowPayload(row, ctx);
      const product = await createProduct(tenantId, data, tx);
      if (data.trackInventory && data.defaultWarehouseId) {
        await tx.inventoryStockBalance.create({ data: { tenantId, warehouseId: data.defaultWarehouseId, productId: product.id, quantity: new Decimal(stock) } });
        if (stock > 0) await tx.inventoryMovement.create({ data: {
          tenantId, productId: product.id, warehouseId: data.defaultWarehouseId, direction: "IN", quantity: new Decimal(stock),
          movementType: "OPENING", date: new Date(), description: "Stock inicial importado", sourceType: "import", sourceId: product.id, createdByUserId: userId,
        } });
        await tx.lightweightProduct.update({ where: { id: product.id, tenantId }, data: { stock } });
      }
    }
    return { created: preview.valid.length };
  }, { timeout: 60000 });
}
