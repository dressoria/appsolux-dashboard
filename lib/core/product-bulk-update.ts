import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { productNumber, parseProductTax, ProductInputError } from "./inventory-product-input";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";

// ── Types ────────────────────────────────────────────────────────────────

export type BulkUpdateTab = "datos" | "precios" | "stock";

export type BulkUpdateRow = {
  productId: string;
  productName: string;
  primaryCode: string | null;
  changes: Record<string, unknown>;
};

export type BulkPreviewChange = {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
};

export type BulkPreviewRow = {
  productId: string;
  productName: string;
  primaryCode: string | null;
  changes: BulkPreviewChange[];
  issues: Array<{ field: string; message: string }>;
  status: "READY" | "NEEDS_REVIEW" | "NO_CHANGE";
};

export type BulkPreviewResult = {
  rows: BulkPreviewRow[];
  counts: {
    ready: number;
    noChange: number;
    needsReview: number;
  };
};

export type BulkConfirmResult = {
  updated: number;
  skipped: number;
};

// ── Datos fields ─────────────────────────────────────────────────────────

const DATOS_FIELDS: Record<string, { label: string; type: "text" | "select" | "boolean" }> = {
  name: { label: "Nombre", type: "text" },
  description: { label: "Descripción", type: "text" },
  primaryCode: { label: "Código principal", type: "text" },
  barcode: { label: "Código de barras", type: "text" },
  auxiliaryCode: { label: "Código auxiliar", type: "text" },
  isActive: { label: "Activo", type: "boolean" },
  trackInventory: { label: "Controlar inventario", type: "boolean" },
};

// ── Precios fields ──────────────────────────────────────────────────────

const PRECIOS_FIELDS: Record<string, { label: string }> = {
  cost: { label: "Costo" },
  price: { label: "PVP Público" },
  price2: { label: "PVP Distribuidor" },
  price3: { label: "PVP Mayorista" },
  price4: { label: "PVP Tarjeta" },
  taxCategory: { label: "Categoría IVA" },
  taxRate: { label: "Tarifa IVA" },
};

// ── Stock fields ────────────────────────────────────────────────────────

const STOCK_FIELDS: Record<string, { label: string }> = {
  stock: { label: "Stock" },
  minStock: { label: "Stock mínimo" },
};

function getFieldDefs(tab: BulkUpdateTab) {
  if (tab === "datos") return DATOS_FIELDS;
  if (tab === "precios") return PRECIOS_FIELDS;
  return STOCK_FIELDS;
}

// ── Preview ─────────────────────────────────────────────────────────────

export async function previewBulkUpdate(
  tenantId: string,
  tab: BulkUpdateTab,
  rows: BulkUpdateRow[],
): Promise<BulkPreviewResult> {
  if (rows.length === 0 || rows.length > 5000) {
    throw new ProductInputError("Envía entre 1 y 5000 filas.");
  }

  const prisma = getPrismaClient();
  const productIds = rows.map((r) => r.productId);
  const products = await prisma.lightweightProduct.findMany({
    where: { tenantId, id: { in: productIds } },
    select: {
      id: true, name: true, primaryCode: true, barcode: true, auxiliaryCode: true,
      description: true, isActive: true, trackInventory: true, type: true,
      cost: true, price: true, price2: true, price3: true, price4: true,
      taxCategory: true, taxRate: true, stock: true, minStock: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const fieldDefs = getFieldDefs(tab);
  const result: BulkPreviewRow[] = [];

  for (const row of rows) {
    const product = productMap.get(row.productId);
    if (!product) {
      result.push({
        productId: row.productId,
        productName: row.productName,
        primaryCode: row.primaryCode,
        changes: [],
        issues: [{ field: "productId", message: "Producto no encontrado." }],
        status: "NEEDS_REVIEW",
      });
      continue;
    }

    const changes: BulkPreviewChange[] = [];
    const issues: Array<{ field: string; message: string }> = [];

    for (const [field, newValue] of Object.entries(row.changes)) {
      if (!(field in fieldDefs)) continue;
      const def = fieldDefs[field];
      const oldValue = (product as Record<string, unknown>)[field];

      if (tab === "precios" && (field === "taxCategory" || field === "taxRate")) {
        continue;
      }

      if (tab === "precios") {
        try {
          productNumber(newValue, field);
        } catch (error) {
          issues.push({ field, message: error instanceof Error ? error.message : "Valor inválido." });
          continue;
        }
      }

      if (tab === "stock" && field === "stock") {
        try {
          productNumber(newValue, field, true);
        } catch (error) {
          issues.push({ field, message: error instanceof Error ? error.message : "Valor inválido." });
          continue;
        }
        if (product.type === "SERVICE") {
          issues.push({ field: "stock", message: "Los servicios no tienen stock." });
          continue;
        }
        if (!product.trackInventory) {
          issues.push({ field: "stock", message: "Este producto no controla inventario." });
          continue;
        }
      }

      if (tab === "stock" && field === "minStock") {
        if (newValue != null && newValue !== "") {
          try {
            productNumber(newValue, field, true);
          } catch (error) {
            issues.push({ field, message: error instanceof Error ? error.message : "Valor inválido." });
            continue;
          }
        }
      }

      if (tab === "datos" && field === "name" && (!newValue || String(newValue).trim() === "")) {
        issues.push({ field: "name", message: "El nombre no puede estar vacío." });
        continue;
      }

      const oldStr = formatValue(oldValue);
      const newStr = formatValue(newValue);
      if (oldStr !== newStr) {
        changes.push({ field, label: def.label, oldValue, newValue });
      }
    }

    if (tab === "precios" && ("taxCategory" in row.changes || "taxRate" in row.changes)) {
      const newCat = row.changes.taxCategory ?? product.taxCategory;
      const newRate = row.changes.taxRate ?? product.taxRate;
      try {
        parseProductTax(
          newCat === "NON_OBJECT" || newCat === "EXEMPT"
            ? String(newCat)
            : String(newRate ?? 0),
        );
        const oldCat = product.taxCategory;
        const oldRate = Number(product.taxRate ?? 0);
        if (String(newCat) !== String(oldCat)) {
          changes.push({ field: "taxCategory", label: "Categoría IVA", oldValue: oldCat, newValue: newCat });
        }
        if (Number(newRate) !== oldRate) {
          changes.push({ field: "taxRate", label: "Tarifa IVA", oldValue: oldRate, newValue: newRate });
        }
      } catch (error) {
        issues.push({ field: "iva", message: error instanceof Error ? error.message : "IVA inválido." });
      }
    }

    const status = issues.length > 0 ? "NEEDS_REVIEW" : changes.length === 0 ? "NO_CHANGE" : "READY";

    result.push({
      productId: row.productId,
      productName: product.name,
      primaryCode: product.primaryCode,
      changes,
      issues,
      status,
    });
  }

  return {
    rows: result,
    counts: {
      ready: result.filter((r) => r.status === "READY").length,
      noChange: result.filter((r) => r.status === "NO_CHANGE").length,
      needsReview: result.filter((r) => r.status === "NEEDS_REVIEW").length,
    },
  };
}

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Decimal) return value.toString();
  return String(value);
}

// ── Confirm ─────────────────────────────────────────────────────────────

export async function confirmBulkUpdate(
  tenantId: string,
  tab: BulkUpdateTab,
  rows: BulkUpdateRow[],
  userId: string,
): Promise<BulkConfirmResult> {
  await requireTenantOperationalAccess(tenantId);
  const prisma = getPrismaClient();

  const preview = await previewBulkUpdate(tenantId, tab, rows);
  const ready = preview.rows.filter((r) => r.status === "READY");

  if (ready.length === 0) {
    return { updated: 0, skipped: preview.rows.length };
  }

  return prisma.$transaction(
    async (tx) => {
      let updated = 0;

      for (const row of ready) {
        const data: Record<string, unknown> = {};

        for (const change of row.changes) {
          if (tab === "precios") {
            if (change.field === "taxCategory" || change.field === "taxRate") {
              data[change.field] = change.newValue;
            } else {
              data[change.field] = Number(change.newValue ?? 0);
            }
          } else if (tab === "datos") {
            if (change.field === "isActive" || change.field === "trackInventory") {
              data[change.field] = change.newValue === true || change.newValue === "true";
            } else {
              data[change.field] = change.newValue == null ? null : String(change.newValue).trim() || null;
            }
          } else if (tab === "stock") {
            if (change.field === "stock") {
              const newStock = Number(change.newValue ?? 0);
              const oldStock = Number(change.oldValue ?? 0);
              const diff = newStock - oldStock;

              data.stock = newStock;

              const product = await tx.lightweightProduct.findFirst({
                where: { id: row.productId, tenantId },
                select: { defaultWarehouseId: true },
              });

              const warehouseId = product?.defaultWarehouseId;

              if (diff !== 0) {
                await tx.lightweightStockMovement.create({
                  data: {
                    tenantId,
                    productId: row.productId,
                    type: "adjustment",
                    quantity: diff,
                  },
                });

                if (warehouseId) {
                  await tx.inventoryMovement.create({
                    data: {
                      tenantId,
                      productId: row.productId,
                      warehouseId,
                      direction: diff > 0 ? "IN" : "OUT",
                      movementType: "ADJUSTMENT",
                      quantity: new Decimal(Math.abs(diff)),
                      date: new Date(),
                      description: "Ajuste masivo de stock",
                      sourceType: "BULK_UPDATE",
                      sourceId: row.productId,
                      createdByUserId: userId,
                    },
                  });

                  await tx.inventoryStockBalance.upsert({
                    where: {
                      tenantId_warehouseId_productId: {
                        tenantId,
                        warehouseId,
                        productId: row.productId,
                      },
                    },
                    create: {
                      tenantId,
                      productId: row.productId,
                      warehouseId,
                      quantity: new Decimal(newStock),
                    },
                    update: { quantity: { increment: diff } },
                  });
                }
              }
            } else if (change.field === "minStock") {
              data[change.field] = change.newValue == null || change.newValue === ""
                ? null
                : Number(change.newValue);
            }
          }
        }

        if (tab !== "stock" || Object.keys(data).length > 0) {
          await tx.lightweightProduct.update({
            where: { id: row.productId, tenantId },
            data,
          });
        }

        updated++;
      }

      return { updated, skipped: preview.rows.length - ready.length };
    },
    { timeout: 60000 },
  );
}
