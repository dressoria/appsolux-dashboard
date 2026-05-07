import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { adjustProductStock } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const { productId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const quantity =
      typeof body.quantity === "number"
        ? body.quantity
        : Number(body.quantity ?? 0);
    const reason = typeof body.reason === "string" ? body.reason : undefined;
    const product = await adjustProductStock({
      tenantId: tenant.id,
      productId,
      quantity,
      reason,
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo ajustar stock.",
      },
      { status: 400 }
    );
  }
}
