import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getCostExpenseConcepts, createCostExpenseConcept } from "@/lib/core/accounting-concepts";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const concepts = await getCostExpenseConcepts(tenant.id);
  return NextResponse.json(concepts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { code, name, description, costAccountId, expenseAccountId } = body;

  if (!code || !name) {
    return NextResponse.json({ error: "Campos obligatorios: code, name." }, { status: 400 });
  }

  const concept = await createCostExpenseConcept(tenant.id, {
    code, name, description, costAccountId, expenseAccountId,
  });
  return NextResponse.json(concept);
}
