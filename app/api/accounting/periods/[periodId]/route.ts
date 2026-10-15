import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { updatePeriodStatus } from "@/lib/core/accounting-periods";
import type { AccountingPeriodStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { periodId } = await params;

  const body = await req.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json({ error: "Estado requerido." }, { status: 400 });
  }

  try {
    const period = await updatePeriodStatus(tenant.id, periodId, status as AccountingPeriodStatus, user.id);
    return NextResponse.json(period);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar período";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
