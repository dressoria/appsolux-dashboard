import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getTrialBalance } from "@/lib/core/accounting-reports";
import { getActivePlan } from "@/lib/core/accounting-plan";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const plan = await getActivePlan(tenant.id);
  if (!plan) return NextResponse.json({ error: "No hay plan de cuentas activo." }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "Parámetros requeridos: dateFrom, dateTo." }, { status: 400 });
  }

  const rows = await getTrialBalance(tenant.id, {
    planId: plan.id,
    dateFrom: new Date(dateFrom),
    dateTo: new Date(dateTo),
  });

  return NextResponse.json(rows);
}
