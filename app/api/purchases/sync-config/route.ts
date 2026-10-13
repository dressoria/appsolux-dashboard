import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSyncConfig, upsertSyncConfig, getAdapterForTenant } from "@/lib/core/purchase-sync-adapter";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const config = await getSyncConfig(tenant.id);
  return NextResponse.json(config ?? { status: "DISABLED" });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();

  if (body.action === "test_connection") {
    const config = await getSyncConfig(tenant.id);
    const adapter = getAdapterForTenant(tenant.id, config?.provider);
    const result = await adapter.testConnection();
    return NextResponse.json(result);
  }

  const config = await upsertSyncConfig(tenant.id, {
    status: body.status,
    provider: body.provider,
    autoClassify: body.autoClassify,
    autoDetectDeductibility: body.autoDetectDeductibility,
  });

  return NextResponse.json({ ok: true, config });
}
