import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPlans, createPlan, updatePlanStatus } from "@/lib/core/accounting-plan";
import type { AccountingPlanStatus } from "@prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const plans = await getPlans(tenant.id);
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { name, description, source, action, planId, status } = body;

  if (action === "updateStatus" && planId && status) {
    const plan = await updatePlanStatus(tenant.id, planId, status as AccountingPlanStatus);
    return NextResponse.json(plan);
  }

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });
  }

  const plan = await createPlan(tenant.id, { name, description, source }, user.id);
  return NextResponse.json(plan);
}
