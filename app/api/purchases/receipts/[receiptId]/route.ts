import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { confirmPurchaseReceipt } from "@/lib/core/purchase-documents";

type RouteParams = { params: Promise<{ receiptId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { receiptId } = await params;

  const body = await req.json();
  if (body.action === "confirm") {
    try {
      await confirmPurchaseReceipt(tenant.id, receiptId);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Error." },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
