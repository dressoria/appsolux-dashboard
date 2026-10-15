import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { executeClosing } from "@/lib/core/accounting-closing";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { year } = body;

  if (!year || typeof year !== "number") {
    return NextResponse.json({ error: "Año requerido." }, { status: 400 });
  }

  try {
    const result = await executeClosing(tenant.id, year, user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al ejecutar cierre";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
