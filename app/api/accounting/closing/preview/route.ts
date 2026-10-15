import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getClosingPreview } from "@/lib/core/accounting-closing";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const year = req.nextUrl.searchParams.get("year");
  if (!year) return NextResponse.json({ error: "Año requerido." }, { status: 400 });

  try {
    const preview = await getClosingPreview(tenant.id, parseInt(year, 10));
    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar vista previa";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
