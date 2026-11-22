import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { gateModuleApiAccess } from "@/lib/core/capabilities";
import { getSyncStatus } from "@/lib/core/purchase-sync-jobs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const gate = await gateModuleApiAccess(tenant.id, "purchases");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const status = await getSyncStatus(tenant.id);
  return NextResponse.json(status);
}
