import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getCostCenters, createCostCenter } from "@/lib/core/accounting-cost-centers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const centers = await getCostCenters(tenant.id);
  return NextResponse.json(centers);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { code, name, description, type, parentId } = body;

  if (!code || !name) {
    return NextResponse.json({ error: "Campos obligatorios: code, name." }, { status: 400 });
  }

  const center = await createCostCenter(tenant.id, { code, name, description, type, parentId });
  return NextResponse.json(center);
}
