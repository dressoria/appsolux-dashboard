import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getWarehouseById, updateWarehouse } from "@/lib/core/inventory-warehouses";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { warehouseId } = await params;
  const warehouse = await getWarehouseById(tenant.id, warehouseId);
  if (!warehouse) return NextResponse.json({ error: "Bodega no encontrada." }, { status: 404 });
  return NextResponse.json(warehouse);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { warehouseId } = await params;
  const body = await req.json();
  const warehouse = await updateWarehouse(tenant.id, warehouseId, body);
  return NextResponse.json(warehouse);
}
