import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getShipmentGuideById, updateShipmentGuideStatus } from "@/lib/core/inventory-guides";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { guideId } = await params;

  const guide = await getShipmentGuideById(tenant.id, guideId);
  if (!guide) return NextResponse.json({ error: "Guía no encontrada." }, { status: 404 });
  return NextResponse.json(guide);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { guideId } = await params;

  const body = await req.json();
  if (!body.status) return NextResponse.json({ error: "Estado requerido." }, { status: 400 });

  const guide = await updateShipmentGuideStatus(tenant.id, guideId, body.status);
  return NextResponse.json(guide);
}
