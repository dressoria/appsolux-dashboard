import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPhysicalCounts, createPhysicalCount } from "@/lib/core/inventory-physical-counts";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const url = req.nextUrl;
  const result = await getPhysicalCounts(tenant.id, {
    status: url.searchParams.get("status") ?? undefined,
    warehouseId: url.searchParams.get("warehouseId") ?? undefined,
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
  if (!body.warehouseId) {
    return NextResponse.json({ error: "Bodega requerida." }, { status: 400 });
  }

  const count = await createPhysicalCount(tenant.id, body.warehouseId, user.id, body.notes);
  return NextResponse.json(count, { status: 201 });
}
