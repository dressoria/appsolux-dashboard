import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPhysicalCountById, updateCountItem } from "@/lib/core/inventory-physical-counts";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ countId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { countId } = await params;

  const pc = await getPhysicalCountById(tenant.id, countId);
  if (!pc) return NextResponse.json({ error: "Toma física no encontrada." }, { status: 404 });
  return NextResponse.json(pc);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ countId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { countId } = await params;

  const body = await req.json();
  if (!body.productId || body.countedQuantity == null) {
    return NextResponse.json({ error: "Producto y cantidad contada requeridos." }, { status: 400 });
  }

  const item = await updateCountItem(tenant.id, countId, body.productId, body.countedQuantity);
  return NextResponse.json(item);
}
