import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getAccountTree, createAccount } from "@/lib/core/accounting-accounts";
import { getActivePlan } from "@/lib/core/accounting-plan";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const plan = await getActivePlan(tenant.id);
  if (!plan) return NextResponse.json({ error: "No hay plan de cuentas activo." }, { status: 404 });

  const accounts = await getAccountTree(tenant.id, plan.id);
  return NextResponse.json({ planId: plan.id, accounts });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const plan = await getActivePlan(tenant.id);
  if (!plan) return NextResponse.json({ error: "No hay plan de cuentas activo." }, { status: 404 });

  const body = await req.json();
  const { code, name, parentId, rootType, normalBalance, isGroup, allowsPosting, f101Code } = body;

  if (!code || !name || !rootType || !normalBalance) {
    return NextResponse.json({ error: "Campos obligatorios: code, name, rootType, normalBalance." }, { status: 400 });
  }

  try {
    const account = await createAccount(tenant.id, plan.id, {
      code, name, parentId, rootType, normalBalance, isGroup, allowsPosting, f101Code,
    });
    return NextResponse.json(account);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear cuenta";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
