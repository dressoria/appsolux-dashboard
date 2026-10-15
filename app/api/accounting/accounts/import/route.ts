import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getActivePlan } from "@/lib/core/accounting-plan";
import { parseXlsxRows, importAccountsFromParsedRows } from "@/lib/core/accounting-import";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const plan = await getActivePlan(tenant.id);
  if (!plan) return NextResponse.json({ error: "No hay plan de cuentas activo." }, { status: 404 });

  const body = await req.json();
  const { rows } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Se requiere un arreglo de cuentas." }, { status: 400 });
  }

  for (const row of rows) {
    if (!row.code || !row.name) {
      return NextResponse.json({ error: "Cada fila requiere code y name." }, { status: 400 });
    }
  }

  const parsed = parseXlsxRows(rows);
  const result = await importAccountsFromParsedRows(tenant.id, plan.id, parsed);
  return NextResponse.json(result);
}
