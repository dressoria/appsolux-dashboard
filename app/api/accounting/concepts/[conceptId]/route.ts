import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { updateCostExpenseConcept } from "@/lib/core/accounting-concepts";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { conceptId } = await params;

  const body = await req.json();
  const concept = await updateCostExpenseConcept(tenant.id, conceptId, body);
  return NextResponse.json(concept);
}
