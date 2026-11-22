import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { gateModuleApiAccess } from "@/lib/core/capabilities";
import { getTransferById } from "@/lib/core/inventory-transfers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ transferId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const gate = await gateModuleApiAccess(tenant.id, "advanced_inventory");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });
  const { transferId } = await params;

  const transfer = await getTransferById(tenant.id, transferId);
  if (!transfer) return NextResponse.json({ error: "Transferencia no encontrada." }, { status: 404 });
  return NextResponse.json(transfer);
}
