import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getWarehouses, createWarehouse } from "@/lib/core/inventory-warehouses";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const warehouses = await getWarehouses(tenant.id);
  return NextResponse.json(warehouses);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const body = await req.json();
  if (!body.code || !body.name) {
    return NextResponse.json({ error: "Código y nombre requeridos." }, { status: 400 });
  }
  const warehouse = await createWarehouse(tenant.id, body);
  return NextResponse.json(warehouse, { status: 201 });
}
