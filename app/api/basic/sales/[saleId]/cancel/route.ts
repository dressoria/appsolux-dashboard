import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { cancelSale } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    saleId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const { saleId } = await context.params;
    const sale = await cancelSale(tenant.id, saleId);

    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo cancelar venta.",
      },
      { status: 400 }
    );
  }
}
