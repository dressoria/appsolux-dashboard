import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export async function GET(request: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();

  const url = request.nextUrl;
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const warehouseId = url.searchParams.get("warehouseId") ?? "";
  const availability = url.searchParams.get("availability") ?? "available";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const perPageRaw = Number(url.searchParams.get("perPage") ?? "12");
  const perPage = [12, 24, 48].includes(perPageRaw) ? perPageRaw : 12;

  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    isActive: true,
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
      { primaryCode: { contains: q, mode: "insensitive" } },
      { auxiliaryCode: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsRaw = await prisma.lightweightProduct.findMany({
    where: where as any,
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      barcode: true,
      primaryCode: true,
      auxiliaryCode: true,
      description: true,
      taxRate: true,
      trackInventory: true,
      type: true,
      taxCategory: true,
      cost: true,
      comboItems: {
        select: {
          quantity: true,
          componentProduct: {
            select: { trackInventory: true, stock: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  let stockMap: Map<string, number> | null = null;
  if (warehouseId) {
    const balances = await prisma.inventoryStockBalance.findMany({
      where: { tenantId: tenant.id, warehouseId },
      select: { productId: true, quantity: true },
    });
    stockMap = new Map(balances.map((b) => [b.productId, Number(b.quantity)]));
  }

  type ProductRow = typeof productsRaw[number];

  function getStock(product: ProductRow): number {
    if (product.type === "COMBO") {
      const tracked = product.comboItems.filter(
        (ci) => ci.componentProduct.trackInventory,
      );
      if (tracked.length === 0) return 999999;
      return Math.max(
        0,
        Math.min(
          ...tracked.map((ci) =>
            Math.floor(ci.componentProduct.stock / Number(ci.quantity)),
          ),
        ),
      );
    }
    if (!product.trackInventory) return 999999;
    if (stockMap) return stockMap.get(product.id) ?? 0;
    return product.stock;
  }

  let filtered = productsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price.toString(),
    stock: getStock(p),
    barcode: p.barcode,
    primaryCode: p.primaryCode,
    auxiliaryCode: p.auxiliaryCode,
    description: p.description,
    taxRate: p.taxRate.toString(),
    trackInventory: p.trackInventory,
    taxCategory: p.taxCategory,
    cost: p.cost?.toString() ?? null,
  }));

  if (availability === "available") {
    filtered = filtered.filter((p) => !p.trackInventory || p.stock > 0);
  } else if (availability === "out_of_stock") {
    filtered = filtered.filter((p) => p.trackInventory && p.stock <= 0);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const products = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return NextResponse.json({
    ok: true,
    products,
    page: safePage,
    perPage,
    total,
    totalPages,
  });
}
