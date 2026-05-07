import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getSaleById } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    saleId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Sesion requerida." },
      { status: 401 }
    );
  }

  const tenant = await getCurrentTenant(user);
  const { saleId } = await context.params;
  const sale = await getSaleById(tenant.id, saleId);

  if (!sale) {
    return NextResponse.json(
      { ok: false, message: "Venta no encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, sale });
}
