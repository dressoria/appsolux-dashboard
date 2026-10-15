import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getInventorySettings, upsertInventorySettings } from "@/lib/core/inventory-settings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const settings = await getInventorySettings(tenant.id);
  return NextResponse.json(settings ?? {});
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const body = await req.json();
  const settings = await upsertInventorySettings(tenant.id, body);
  return NextResponse.json(settings);
}
