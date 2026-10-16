import { productErrorResponse } from "@/lib/core/inventory-product-errors";
import { ProductInputError } from "@/lib/core/inventory-product-input";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getProductById, updateProduct } from "@/lib/core/inventory-products";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { productId } = await params;

  const product = await getProductById(tenant.id, productId);
  if (!product) return NextResponse.json({ code: "PRODUCT_NOT_FOUND", message: "Producto no encontrado." }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { productId } = await params;

  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProductInputError("Datos de producto inválidos.");
    const product = await updateProduct(tenant.id, productId, body);
    return NextResponse.json(product);
  } catch (error) {
    const result = productErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
