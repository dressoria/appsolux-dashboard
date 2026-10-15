import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getOrders, createOrder } from "@/lib/core/inventory-orders";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const url = req.nextUrl;
  const result = await getOrders(tenant.id, {
    status: url.searchParams.get("status") ?? undefined,
    skip: Number(url.searchParams.get("skip") ?? 0),
    take: Number(url.searchParams.get("take") ?? 50),
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  if (!body.warehouseId || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  const order = await createOrder(tenant.id, { ...body, userId: user.id });
  return NextResponse.json(order, { status: 201 });
}
