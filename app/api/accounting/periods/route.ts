import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPeriods, createPeriod } from "@/lib/core/accounting-periods";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const periods = await getPeriods(tenant.id);
  return NextResponse.json(periods);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { year, month } = body;

  if (!year || typeof year !== "number") {
    return NextResponse.json({ error: "Año requerido." }, { status: 400 });
  }

  try {
    const period = await createPeriod(tenant.id, { year, month });
    return NextResponse.json(period);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear período";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
