import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getGeneralLedger } from "@/lib/core/accounting-reports";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const sp = req.nextUrl.searchParams;
  const accountId = sp.get("accountId");
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");

  if (!accountId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "Parámetros requeridos: accountId, dateFrom, dateTo." }, { status: 400 });
  }

  const rows = await getGeneralLedger(tenant.id, {
    accountId,
    dateFrom: new Date(dateFrom),
    dateTo: new Date(dateTo),
  });

  return NextResponse.json(rows);
}
