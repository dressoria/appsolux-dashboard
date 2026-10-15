import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export type ImportRow = {
  tipo?: string;
  codigo?: string;
  codigo_auxiliar?: string;
  codigo_barras?: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  unidad?: string;
  marca?: string;
  bodega?: string;
  costo?: number;
  pvp_publico?: number;
  pvp_distribuidor?: number;
  pvp_mayorista?: number;
  pvp_tarjeta?: number;
  iva?: number;
  stock_inicial?: number;
  stock_minimo?: number;
  activo?: boolean;
};

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

export async function previewImport(
  tenantId: string,
  rows: ImportRow[],
): Promise<ImportPreviewResult> {
  const prisma = getPrismaClient();
  const valid: ImportRow[] = [];
  const errors: ImportPreviewResult["errors"] = [];
  const duplicates: ImportPreviewResult["duplicates"] = [];

  const existingCodes = await prisma.lightweightProduct.findMany({
    where: { tenantId },
    select: { primaryCode: true, barcode: true },
  });

  const codeSet = new Set(existingCodes.map((p) => p.primaryCode).filter(Boolean));
  const barcodeSet = new Set(existingCodes.map((p) => p.barcode).filter(Boolean));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.nombre) {
      errors.push({ row: i + 1, field: "nombre", message: "Nombre requerido" });
      continue;
    }
    if (row.codigo && codeSet.has(row.codigo)) {
      duplicates.push({ row: i + 1, field: "codigo", value: row.codigo });
      continue;
    }
    if (row.codigo_barras && barcodeSet.has(row.codigo_barras)) {
      duplicates.push({ row: i + 1, field: "codigo_barras", value: row.codigo_barras });
      continue;
    }
    if (row.codigo) codeSet.add(row.codigo);
    if (row.codigo_barras) barcodeSet.add(row.codigo_barras);
    valid.push(row);
  }

  return { valid, errors, duplicates };
}

export async function confirmImport(
  tenantId: string,
  rows: ImportRow[],
  userId: string,
  defaultWarehouseId: string,
) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const created: string[] = [];

    for (const row of rows) {
      let categoryId: string | undefined;
      if (row.categoria) {
        const cat = await tx.lightweightProductCategory.findFirst({
          where: { tenantId, name: row.categoria },
        });
        categoryId = cat?.id;
        if (!categoryId) {
          const newCat = await tx.lightweightProductCategory.create({
            data: { tenantId, name: row.categoria },
          });
          categoryId = newCat.id;
        }
      }

      let brandId: string | undefined;
      if (row.marca) {
        const brand = await tx.inventoryBrand.findFirst({
          where: { tenantId, name: row.marca },
        });
        brandId = brand?.id;
        if (!brandId) {
          const newBrand = await tx.inventoryBrand.create({
            data: { tenantId, name: row.marca },
          });
          brandId = newBrand.id;
        }
      }

      const typeMap: Record<string, string> = {
        producto: "PRODUCT",
        servicio: "SERVICE",
        combo: "COMBO",
      };
      const productType = row.tipo
        ? (typeMap[row.tipo.toLowerCase()] ?? "PRODUCT")
        : "PRODUCT";

      const product = await tx.lightweightProduct.create({
        data: {
          tenantId,
          name: row.nombre,
          description: row.descripcion,
          primaryCode: row.codigo,
          auxiliaryCode: row.codigo_auxiliar,
          barcode: row.codigo_barras,
          type: productType as never,
          categoryId,
          brandId,
          cost: row.costo != null ? new Decimal(row.costo) : undefined,
          price: new Decimal(row.pvp_publico ?? 0),
          price2: row.pvp_distribuidor != null ? new Decimal(row.pvp_distribuidor) : undefined,
          price3: row.pvp_mayorista != null ? new Decimal(row.pvp_mayorista) : undefined,
          price4: row.pvp_tarjeta != null ? new Decimal(row.pvp_tarjeta) : undefined,
          taxRate: new Decimal(row.iva ?? 0),
          minStock: row.stock_minimo,
          isActive: row.activo !== false,
          stock: Math.round(row.stock_inicial ?? 0),
        },
      });

      if (row.stock_inicial && row.stock_inicial > 0) {
        const qty = new Decimal(row.stock_inicial);
        await tx.inventoryStockBalance.create({
          data: {
            tenantId,
            warehouseId: defaultWarehouseId,
            productId: product.id,
            quantity: qty,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: product.id,
            warehouseId: defaultWarehouseId,
            direction: "IN",
            quantity: qty,
            movementType: "OPENING",
            date: new Date(),
            description: "Stock inicial importado",
            sourceType: "import",
            sourceId: product.id,
            createdByUserId: userId,
          },
        });
      }

      created.push(product.id);
    }

    return { created: created.length };
  });
}
