import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getAccountingSettings, upsertAccountingSettings } from "@/lib/core/accounting-settings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const settings = await getAccountingSettings(tenant.id);
  return NextResponse.json(settings ?? { autoPostingEnabled: false });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { autoPostingEnabled } = body;

  const settings = await upsertAccountingSettings(tenant.id, {
    autoPostingEnabled: !!autoPostingEnabled,
  });
  return NextResponse.json(settings);
}
