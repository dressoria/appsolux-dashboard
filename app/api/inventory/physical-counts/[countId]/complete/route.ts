import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { completePhysicalCount } from "@/lib/core/inventory-physical-counts";
import { getAllowNegativeStock } from "@/lib/core/inventory-settings";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ countId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { countId } = await params;

  const allowNeg = await getAllowNegativeStock(tenant.id);
  const result = await completePhysicalCount(tenant.id, countId, user.id, allowNeg);
  return NextResponse.json(result);
}
