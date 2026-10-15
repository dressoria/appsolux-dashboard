import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getCostCenterById, updateCostCenter } from "@/lib/core/accounting-cost-centers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ centerId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { centerId } = await params;

  const center = await getCostCenterById(tenant.id, centerId);
  if (!center) return NextResponse.json({ error: "Centro de costo no encontrado." }, { status: 404 });
  return NextResponse.json(center);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ centerId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { centerId } = await params;

  const body = await req.json();
  const center = await updateCostCenter(tenant.id, centerId, body);
  return NextResponse.json(center);
}
