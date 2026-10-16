import { productErrorResponse } from "@/lib/core/inventory-product-errors";
import { ProductInputError } from "@/lib/core/inventory-product-input";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getProducts, createProduct } from "@/lib/core/inventory-products";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const url = req.nextUrl;
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    brandId: url.searchParams.get("brandId") ?? undefined,
    warehouseId: url.searchParams.get("warehouseId") ?? undefined,
    isActive: url.searchParams.has("isActive") ? url.searchParams.get("isActive") === "true" : undefined,
    stockFilter: (url.searchParams.get("stockFilter") as "all" | "in_stock" | "out_of_stock" | "low_stock") ?? undefined,
    skip: url.searchParams.has("skip") ? Number(url.searchParams.get("skip")) : 0,
    take: url.searchParams.has("take") ? Number(url.searchParams.get("take")) : 50,
  };

  const result = await getProducts(tenant.id, filters);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProductInputError("Datos de producto inválidos.");

    const product = await createProduct(tenant.id, body);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    const result = productErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
