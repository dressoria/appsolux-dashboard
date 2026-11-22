import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { gateModuleApiAccess } from "@/lib/core/capabilities";
import { getValuation } from "@/lib/core/inventory-valuation";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const gate = await gateModuleApiAccess(tenant.id, "advanced_inventory");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const warehouseId = req.nextUrl.searchParams.get("warehouseId") ?? undefined;
  const result = await getValuation(tenant.id, { warehouseId });
  return NextResponse.json(result);
}
