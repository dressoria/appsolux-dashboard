import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { searchAccounts } from "@/lib/core/accounting-accounts";
import { getActivePlan } from "@/lib/core/accounting-plan";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const plan = await getActivePlan(tenant.id);
  if (!plan) return NextResponse.json({ error: "No hay plan de cuentas activo." }, { status: 404 });

  const query = req.nextUrl.searchParams.get("q") ?? "";
  if (!query.trim()) return NextResponse.json([]);

  const accounts = await searchAccounts(tenant.id, plan.id, query.trim());
  return NextResponse.json(accounts);
}
