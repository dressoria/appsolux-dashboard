import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { completeTransfer } from "@/lib/core/inventory-transfers";
import { getAllowNegativeStock } from "@/lib/core/inventory-settings";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ transferId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { transferId } = await params;

  const allowNeg = await getAllowNegativeStock(tenant.id);
  const result = await completeTransfer(tenant.id, transferId, user.id, allowNeg);
  return NextResponse.json(result);
}
