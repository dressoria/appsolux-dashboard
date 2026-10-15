import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getUnits, createUnit, updateUnit } from "@/lib/core/inventory-units";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const units = await getUnits(tenant.id);
  return NextResponse.json(units);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const body = await req.json();
  if (!body.code || !body.name) {
    return NextResponse.json({ error: "Código y nombre requeridos." }, { status: 400 });
  }

  if (body.id) {
    const unit = await updateUnit(tenant.id, body.id, body);
    return NextResponse.json(unit);
  }
  const unit = await createUnit(tenant.id, body);
  return NextResponse.json(unit, { status: 201 });
}
