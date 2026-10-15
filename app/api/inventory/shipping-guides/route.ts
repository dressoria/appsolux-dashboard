import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getShipmentGuides, createShipmentGuide } from "@/lib/core/inventory-guides";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const url = req.nextUrl;
  const result = await getShipmentGuides(tenant.id, {
    status: url.searchParams.get("status") ?? undefined,
    dateFrom: url.searchParams.has("dateFrom") ? new Date(url.searchParams.get("dateFrom")!) : undefined,
    dateTo: url.searchParams.has("dateTo") ? new Date(url.searchParams.get("dateTo")!) : undefined,
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
  if (!body.issueDate || !body.originAddress || !body.destinationAddress || !body.reason) {
    return NextResponse.json({ error: "Campos requeridos incompletos." }, { status: 400 });
  }

  const guide = await createShipmentGuide(tenant.id, {
    ...body,
    issueDate: new Date(body.issueDate),
    startTransportDate: new Date(body.startTransportDate),
    endTransportDate: body.endTransportDate ? new Date(body.endTransportDate) : undefined,
    userId: user.id,
  });
  return NextResponse.json(guide, { status: 201 });
}
