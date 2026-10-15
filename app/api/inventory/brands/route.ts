import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getBrands, createBrand, updateBrand } from "@/lib/core/inventory-brands";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const brands = await getBrands(tenant.id);
  return NextResponse.json(brands);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });

  if (body.id) {
    const brand = await updateBrand(tenant.id, body.id, body);
    return NextResponse.json(brand);
  }
  const brand = await createBrand(tenant.id, body);
  return NextResponse.json(brand, { status: 201 });
}
