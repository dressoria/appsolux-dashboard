import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { createProduct } from "./inventory-products";
import {
  normalizeProductInput,
  parseProductTax,
  productNumber,
  ProductInputError,
} from "./inventory-product-input";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";

export const productImportColumns = [
  "tipo",
  "codigo",
  "codigo_auxiliar",
  "codigo_barras",
  "nombre",
  "descripcion",
  "categoria",
  "unidad",
  "marca",
  "bodega",
  "costo",
  "pvp_publico",
  "pvp_distribuidor",
  "pvp_mayorista",
  "pvp_tarjeta",
  "iva",
  "stock_inicial",
  "stock_minimo",
  "controlar_inventario",
  "activo",
] as const;

export type ProductImportColumn = (typeof productImportColumns)[number];
export type ProductImportRow = Record<ProductImportColumn, string>;

export type ProductImportRowStatus =
  | "READY"
  | "SKIP_EXISTING"
  | "SKIP_DUPLICATE_FILE"
  | "NEEDS_REVIEW"
  | "EXCLUDED";

export type ProductImportIssue = {
  field: string;
  message: string;
};

export type ProductImportPreviewRow = {
  rowNumber: number;
  data: ProductImportRow;
  status: ProductImportRowStatus;
  issues: ProductImportIssue[];
  selectedForImport: boolean;
  autofilledFields: string[];
};

export type ProductImportPreviewResult = {
  rows: ProductImportPreviewRow[];
  counts: {
    ready: number;
    skipExisting: number;
    skipDuplicateFile: number;
    needsReview: number;
  };
};

export const MAX_PRODUCT_IMPORT_ROWS = 2000;

const TYPE_MAP: Record<string, string> = {
  PRODUCTO: "PRODUCT",
  SERVICIO: "SERVICE",
  COMBO: "COMBO",
  PRODUCT: "PRODUCT",
  SERVICE: "SERVICE",
};

const MONEY_FIELDS = ["costo", "pvp_publico", "pvp_distribuidor", "pvp_mayorista", "pvp_tarjeta"] as const;
const MONEY_FIELD_MAP: Record<string, string> = {
  costo: "cost",
  pvp_publico: "price",
  pvp_distribuidor: "price2",
  pvp_mayorista: "price3",
  pvp_tarjeta: "price4",
};

function parseBool(value: string, defaultValue: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return defaultValue;
  return !["false", "0", "no"].includes(v);
}

export function resolveTrackInventory(type: string, raw: string): boolean {
  if (type === "SERVICE") return false;
  if (type === "COMBO") return false;
  if (!raw.trim()) return true;
  return parseBool(raw, true);
}

function normalizeProductRow(
  row: ProductImportRow,
): { data: ProductImportRow; autofilledFields: string[] } {
  const data = { ...row };
  const autofilledFields: string[] = [];

  data.nombre = data.nombre?.trim() ?? "";
  data.tipo = data.tipo?.trim().toUpperCase() ?? "";
  data.codigo = data.codigo?.trim() ?? "";
  data.codigo_auxiliar = data.codigo_auxiliar?.trim() ?? "";
  data.codigo_barras = data.codigo_barras?.trim() ?? "";
  data.descripcion = data.descripcion?.trim() ?? "";
  data.categoria = data.categoria?.trim() ?? "";
  data.unidad = data.unidad?.trim() ?? "";
  data.marca = data.marca?.trim() ?? "";
  data.bodega = data.bodega?.trim() ?? "";
  data.iva = data.iva?.trim() ?? "";
  data.activo = data.activo?.trim() ?? "";
  data.controlar_inventario = data.controlar_inventario?.trim() ?? "";

  if (!data.tipo) {
    data.tipo = "PRODUCTO";
    autofilledFields.push("tipo");
  }

  if (!data.iva) {
    data.iva = "15";
    autofilledFields.push("iva");
  }

  if (!data.activo) {
    data.activo = "true";
    autofilledFields.push("activo");
  }

  const resolvedType = TYPE_MAP[data.tipo.toUpperCase()] ?? "";
  if ((resolvedType === "COMBO" || resolvedType === "SERVICE") && data.controlar_inventario) {
    const wantsTracking = ["true", "1", "si", "sí"].includes(data.controlar_inventario.toLowerCase());
    if (wantsTracking) {
      data.controlar_inventario = "false";
      autofilledFields.push("controlar_inventario");
    }
  }

  return { data, autofilledFields };
}

type ImportContext = {
  existingCodes: Set<string>;
  existingBarcodes: Set<string>;
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; code?: string }>;
  warehouses: Array<{ id: string; name: string; code?: string; isDefault: boolean }>;
};

export async function loadProductImportContext(tenantId: string, prisma: Prisma.TransactionClient = getPrismaClient()): Promise<ImportContext> {
  const [products, categories, brands, units, warehouses] = await Promise.all([
    prisma.lightweightProduct.findMany({
      where: { tenantId },
      select: { primaryCode: true, barcode: true },
    }),
    prisma.lightweightProductCategory.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.inventoryBrand.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.inventoryUnit.findMany({ where: { tenantId }, select: { id: true, name: true, code: true } }),
    prisma.inventoryWarehouse.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true, code: true, isDefault: true },
    }),
  ]);
  return {
    existingCodes: new Set(products.map((p) => p.primaryCode).filter(Boolean) as string[]),
    existingBarcodes: new Set(products.map((p) => p.barcode).filter(Boolean) as string[]),
    categories,
    brands,
    units,
    warehouses,
  };
}

function findCatalogItem(
  catalog: Array<{ id: string; name: string; code?: string }>,
  value: string,
): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  const match = catalog.find(
    (item) =>
      item.name.toLowerCase() === lower ||
      ("code" in item && String(item.code ?? "").toLowerCase() === lower),
  );
  return match?.id ?? null;
}

function validateRow(
  data: ProductImportRow,
  ctx: ImportContext,
): ProductImportIssue[] {
  const issues: ProductImportIssue[] = [];

  if (!data.nombre) {
    issues.push({ field: "nombre", message: "Nombre es obligatorio." });
  }

  const typeKey = data.tipo.toUpperCase();
  if (!TYPE_MAP[typeKey]) {
    issues.push({ field: "tipo", message: `Tipo inválido: ${data.tipo}. Usa PRODUCTO, SERVICIO o COMBO.` });
  }

  for (const field of MONEY_FIELDS) {
    const raw = data[field];
    if (raw) {
      try {
        productNumber(raw, field);
      } catch (error) {
        issues.push({ field, message: error instanceof Error ? error.message : "Valor inválido." });
      }
    }
  }

  if (data.iva) {
    try {
      parseProductTax(data.iva);
    } catch (error) {
      issues.push({ field: "iva", message: error instanceof Error ? error.message : "IVA inválido." });
    }
  }

  if (data.stock_inicial) {
    try {
      const stock = productNumber(data.stock_inicial, "stock_inicial", true);
      const resolvedType = TYPE_MAP[typeKey];
      if (resolvedType === "SERVICE" && stock !== 0) {
        issues.push({ field: "stock_inicial", message: "Un servicio no puede tener stock inicial." });
      }
      if (resolvedType === "COMBO" && stock !== 0) {
        issues.push({ field: "stock_inicial", message: "Un combo virtual no puede tener stock inicial propio." });
      }
    } catch (error) {
      issues.push({ field: "stock_inicial", message: error instanceof Error ? error.message : "Valor inválido." });
    }
  }

  if (data.stock_minimo) {
    try {
      productNumber(data.stock_minimo, "stock_minimo", true);
    } catch (error) {
      issues.push({ field: "stock_minimo", message: error instanceof Error ? error.message : "Valor inválido." });
    }
  }

  if (data.activo) {
    const v = data.activo.toLowerCase();
    if (!["true", "false", "1", "0", "si", "sí", "no", ""].includes(v)) {
      issues.push({ field: "activo", message: "Valor inválido para activo." });
    }
  }

  if (data.controlar_inventario) {
    const v = data.controlar_inventario.toLowerCase();
    if (!["true", "false", "1", "0", "si", "sí", "no", ""].includes(v)) {
      issues.push({ field: "controlar_inventario", message: "Valor inválido." });
    }
  }

  if (data.categoria && !findCatalogItem(ctx.categories, data.categoria)) {
    issues.push({ field: "categoria", message: `Categoría "${data.categoria}" no encontrada.` });
  }

  if (data.marca && !findCatalogItem(ctx.brands, data.marca)) {
    issues.push({ field: "marca", message: `Marca "${data.marca}" no encontrada.` });
  }

  if (data.unidad && !findCatalogItem(ctx.units, data.unidad)) {
    issues.push({ field: "unidad", message: `Unidad "${data.unidad}" no encontrada.` });
  }

  const resolvedType = TYPE_MAP[typeKey];
  const needsWarehouse = resolvedType && resolvedType !== "SERVICE" && resolvedType !== "COMBO";
  if (needsWarehouse && data.bodega && !findCatalogItem(ctx.warehouses, data.bodega)) {
    issues.push({ field: "bodega", message: `Bodega "${data.bodega}" no encontrada.` });
  }

  if (needsWarehouse && !data.bodega) {
    const hasDefault = ctx.warehouses.some((w) => w.isDefault);
    if (!hasDefault) {
      issues.push({ field: "bodega", message: "Configura una bodega predeterminada o especifica una." });
    }
  }

  return issues;
}

export function processProductImportRows(
  rows: ProductImportRow[],
  ctx: ImportContext,
): ProductImportPreviewResult {
  if (rows.length === 0 || rows.length > MAX_PRODUCT_IMPORT_ROWS) {
    throw new ProductInputError(`Envía entre 1 y ${MAX_PRODUCT_IMPORT_ROWS} filas.`);
  }
  const seenCodes = new Set<string>();
  const seenBarcodes = new Set<string>();
  const result: ProductImportPreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const { data, autofilledFields } = normalizeProductRow(rows[i]);
    const issues = validateRow(data, ctx);
    let status: ProductImportRowStatus = issues.length > 0 ? "NEEDS_REVIEW" : "READY";

    if (status === "READY") {
      if (data.codigo) {
        if (ctx.existingCodes.has(data.codigo) || seenCodes.has(data.codigo)) {
          status = ctx.existingCodes.has(data.codigo) ? "SKIP_EXISTING" : "SKIP_DUPLICATE_FILE";
        } else {
          seenCodes.add(data.codigo);
        }
      }

      if (data.codigo_barras && status === "READY") {
        if (ctx.existingBarcodes.has(data.codigo_barras) || seenBarcodes.has(data.codigo_barras)) {
          status = ctx.existingBarcodes.has(data.codigo_barras)
            ? "SKIP_EXISTING"
            : "SKIP_DUPLICATE_FILE";
        } else {
          seenBarcodes.add(data.codigo_barras);
        }
      }
    }

    result.push({
      rowNumber,
      data,
      status,
      issues,
      selectedForImport: status === "READY" || status === "NEEDS_REVIEW",
      autofilledFields,
    });
  }

  return {
    rows: result,
    counts: {
      ready: result.filter((r) => r.status === "READY").length,
      skipExisting: result.filter((r) => r.status === "SKIP_EXISTING").length,
      skipDuplicateFile: result.filter((r) => r.status === "SKIP_DUPLICATE_FILE").length,
      needsReview: result.filter((r) => r.status === "NEEDS_REVIEW").length,
    },
  };
}

export function revalidateProductRows(
  rows: ProductImportPreviewRow[],
  ctx: ImportContext,
): ProductImportPreviewResult {
  const rawRows = rows.map((r) => r.data);
  const result = processProductImportRows(rawRows, ctx);

  for (let i = 0; i < result.rows.length; i++) {
    if (rows[i].status === "EXCLUDED") {
      result.rows[i].status = "EXCLUDED";
      result.rows[i].selectedForImport = false;
    }
  }
  result.counts.ready = result.rows.filter((r) => r.status === "READY").length;
  return result;
}

export async function confirmProductImport(
  tenantId: string,
  previewRows: ProductImportPreviewRow[],
  userId: string,
): Promise<{ imported: number; skippedExisting: number; skippedDuplicateFile: number }> {
  await requireTenantOperationalAccess(tenantId);
  const prisma = getPrismaClient();

  const selected = previewRows.filter(
    (r) =>
      r.selectedForImport &&
      r.status !== "EXCLUDED" &&
      r.status !== "SKIP_EXISTING" &&
      r.status !== "SKIP_DUPLICATE_FILE",
  );

  if (selected.length === 0) {
    throw new ProductInputError("No hay filas seleccionadas para importar.");
  }

  return prisma.$transaction(
    async (tx) => {
      const ctx = await loadProductImportContext(tenantId, tx);
      const revalidated = processProductImportRows(
        selected.map((r) => r.data),
        ctx,
      );

      if (revalidated.rows.some((r) => r.status === "NEEDS_REVIEW")) {
        throw new ProductInputError("Algunas filas tienen errores. Revisa la vista previa.");
      }

      const toImport = revalidated.rows.filter((r) => r.status === "READY");
      let imported = 0;

      for (const row of toImport) {
        const d = row.data;
        const typeKey = d.tipo.toUpperCase();
        const type = TYPE_MAP[typeKey] ?? "PRODUCT";
        const tax = parseProductTax(d.iva || "15");
        const trackInventory = resolveTrackInventory(type, d.controlar_inventario);

        const categoryId = findCatalogItem(ctx.categories, d.categoria);
        const brandId = findCatalogItem(ctx.brands, d.marca);
        const unitId = findCatalogItem(ctx.units, d.unidad);
        const warehouseId =
          (type === "SERVICE" || type === "COMBO")
            ? null
            : findCatalogItem(ctx.warehouses, d.bodega) ??
              ctx.warehouses.find((w) => w.isDefault)?.id ??
              null;

        const input = normalizeProductInput({
          name: d.nombre,
          type,
          primaryCode: d.codigo || null,
          auxiliaryCode: d.codigo_auxiliar || null,
          barcode: d.codigo_barras || null,
          description: d.descripcion || null,
          categoryId,
          brandId,
          unitId,
          defaultWarehouseId: warehouseId,
          cost: productNumber(d.costo, "costo"),
          price: productNumber(d.pvp_publico, "pvp_publico"),
          price2: productNumber(d.pvp_distribuidor, "pvp_distribuidor"),
          price3: productNumber(d.pvp_mayorista, "pvp_mayorista"),
          price4: productNumber(d.pvp_tarjeta, "pvp_tarjeta"),
          ...tax,
          minStock:
            d.stock_minimo ? productNumber(d.stock_minimo, "stock_minimo", true) : null,
          isActive: parseBool(d.activo, true),
          trackInventory,
        });

        const product = await createProduct(tenantId, input, tx);

        if (trackInventory && warehouseId) {
          const stock = productNumber(d.stock_inicial, "stock_inicial", true);
          await tx.inventoryStockBalance.create({
            data: {
              tenantId,
              warehouseId,
              productId: product.id,
              quantity: new Decimal(stock),
            },
          });
          if (stock > 0) {
            await tx.inventoryMovement.create({
              data: {
                tenantId,
                productId: product.id,
                warehouseId,
                direction: "IN",
                quantity: new Decimal(stock),
                movementType: "OPENING",
                date: new Date(),
                description: "Stock inicial importado",
                sourceType: "import",
                sourceId: product.id,
                createdByUserId: userId,
              },
            });
          }
          await tx.lightweightProduct.update({
            where: { id: product.id, tenantId },
            data: { stock },
          });
        }

        imported++;
      }

      return {
        imported,
        skippedExisting: revalidated.counts.skipExisting,
        skippedDuplicateFile: revalidated.counts.skipDuplicateFile,
      };
    },
    { timeout: 60000 },
  );
}
