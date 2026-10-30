import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { productImportColumns } from "@/lib/core/product-import";
import { productTaxValue } from "@/lib/core/inventory-product-input";

const TYPE_EXPORT_MAP: Record<string, string> = {
  PRODUCT: "PRODUCTO",
  SERVICE: "SERVICIO",
  COMBO: "COMBO",
};

function exportTaxValue(taxCategory: string | null, taxRate: string | number): string {
  const val = productTaxValue(taxCategory, taxRate);
  if (val === "NON_OBJECT") return "NON_OBJECT";
  if (val === "EXEMPT") return "EXEMPT";
  return String(Number(val));
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const url = req.nextUrl;
  const scope = url.searchParams.get("scope") ?? "all";
  const q = url.searchParams.get("q") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const idsParam = url.searchParams.get("ids") ?? undefined;

  const where: Record<string, unknown> = { tenantId: tenant.id };

  if (scope === "selected" && idsParam) {
    const ids = idsParam.split(",").filter(Boolean);
    where.id = { in: ids };
  } else if (scope === "filtered") {
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { primaryCode: { contains: q, mode: "insensitive" } },
        { auxiliaryCode: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ];
    }
    if (type) where.type = type;
  }

  const products = await prisma.lightweightProduct.findMany({
    where,
    include: {
      category: { select: { name: true } },
      brand: { select: { name: true } },
      inventoryUnit: { select: { name: true, code: true } },
      defaultWarehouse: { select: { id: true, name: true, code: true } },
      stockBalances: {
        select: { warehouseId: true, quantity: true },
      },
    },
    orderBy: { name: "asc" },
  });

  let defaultWarehouseId: string | null = null;
  const settings = await prisma.inventorySettings.findUnique({
    where: { tenantId: tenant.id },
    select: { defaultWarehouseId: true },
  });
  if (settings?.defaultWarehouseId) {
    defaultWarehouseId = settings.defaultWarehouseId;
  } else {
    const dw = await prisma.inventoryWarehouse.findFirst({
      where: { tenantId: tenant.id, active: true, isDefault: true },
      select: { id: true },
    });
    if (dw) defaultWarehouseId = dw.id;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Facturom";
  const ws = wb.addWorksheet("PRODUCTOS");

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E52F1" } },
    alignment: { horizontal: "center", vertical: "middle" },
  };

  const headerRow = ws.addRow([...productImportColumns]);
  headerRow.eachCell((cell) => { cell.style = headerStyle; });

  ws.columns = productImportColumns.map((col) => {
    const width = col === "descripcion" ? 35 : col === "nombre" ? 30 : col === "categoria" || col === "marca" ? 20 : 16;
    return { width };
  });

  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + productImportColumns.length)}1` };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const p of products) {
    const whId = p.defaultWarehouse?.id ?? defaultWarehouseId;
    let stockInicial = 0;
    if (p.type === "PRODUCT" && p.trackInventory && whId) {
      const balance = p.stockBalances.find((b) => b.warehouseId === whId);
      stockInicial = balance ? Number(balance.quantity) : p.stock;
    }

    const warehouseLabel = p.type === "PRODUCT" && p.trackInventory && p.defaultWarehouse
      ? (p.defaultWarehouse.code || p.defaultWarehouse.name)
      : "";

    const row = ws.addRow([
      TYPE_EXPORT_MAP[p.type] ?? "PRODUCTO",
      p.primaryCode ?? "",
      p.auxiliaryCode ?? "",
      p.barcode ?? "",
      p.name,
      p.description ?? "",
      p.category?.name ?? "",
      p.inventoryUnit?.code || p.inventoryUnit?.name || "",
      p.brand?.name ?? "",
      warehouseLabel,
      Number(p.cost ?? 0),
      Number(p.price),
      Number(p.price2 ?? 0),
      Number(p.price3 ?? 0),
      Number(p.price4 ?? 0),
      exportTaxValue(p.taxCategory, Number(p.taxRate)),
      stockInicial,
      p.minStock ?? 0,
      p.trackInventory ? "true" : "false",
      p.isActive ? "true" : "false",
    ]);

    const descCell = row.getCell(productImportColumns.indexOf("descripcion") + 1);
    descCell.alignment = { wrapText: true };
  }

  const instrWs = wb.addWorksheet("INSTRUCCIONES");
  instrWs.addRows([
    ["Este archivo es compatible con Importar productos de Facturom."],
    [],
    ["Puedes cargarlo en otra empresa/tenant."],
    ["Categorías, unidades, marcas y bodegas deben existir con el mismo nombre/código en el destino."],
    ["Los servicios y combos no llevan stock propio."],
    ["El stock exportado corresponde a la bodega predeterminada."],
    ["La composición interna de combos no se migra en este archivo."],
  ]);
  instrWs.getColumn(1).width = 80;

  const buffer = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="facturom-productos-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
