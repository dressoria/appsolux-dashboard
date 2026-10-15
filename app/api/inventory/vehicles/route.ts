import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getVehicles, createVehicle, updateVehicle } from "@/lib/core/inventory-guides";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const vehicles = await getVehicles(tenant.id);
  return NextResponse.json(vehicles);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const body = await req.json();
  if (!body.plate) return NextResponse.json({ error: "Placa requerida." }, { status: 400 });

  if (body.id) {
    const vehicle = await updateVehicle(tenant.id, body.id, body);
    return NextResponse.json(vehicle);
  }
  const vehicle = await createVehicle(tenant.id, body);
  return NextResponse.json(vehicle, { status: 201 });
}
