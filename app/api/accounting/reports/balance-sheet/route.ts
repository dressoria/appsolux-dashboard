import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getBalanceSheet } from "@/lib/core/accounting-reports";
import { getActivePlan } from "@/lib/core/accounting-plan";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const plan = await getActivePlan(tenant.id);
  if (!plan) return NextResponse.json({ error: "No hay plan de cuentas activo." }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const dateTo = sp.get("dateTo");

  if (!dateTo) {
    return NextResponse.json({ error: "Parámetro requerido: dateTo." }, { status: 400 });
  }

  const result = await getBalanceSheet(tenant.id, {
    planId: plan.id,
    dateFrom: new Date(0),
    dateTo: new Date(dateTo),
  });

  return NextResponse.json(result);
}
