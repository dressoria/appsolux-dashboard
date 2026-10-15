import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getOrderById, updateOrderStatus } from "@/lib/core/inventory-orders";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { orderId } = await params;

  const order = await getOrderById(tenant.id, orderId);
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { orderId } = await params;

  const body = await req.json();
  if (!body.status) return NextResponse.json({ error: "Estado requerido." }, { status: 400 });

  const order = await updateOrderStatus(tenant.id, orderId, body.status);
  return NextResponse.json(order);
}
