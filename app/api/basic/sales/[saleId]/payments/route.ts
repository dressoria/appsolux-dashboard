import { LightweightPaymentMethod } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { addSalePayment } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    saleId: string;
  }>;
};

function isPaymentMethod(value: unknown): value is LightweightPaymentMethod {
  return value === "cash" || value === "transfer" || value === "card";
}

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
    const { saleId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const method = body.method;

    if (!isPaymentMethod(method)) {
      throw new Error("Metodo de abono invalido.");
    }

    const amount =
      typeof body.amount === "number" ? body.amount : Number(body.amount ?? 0);
    const sale = await addSalePayment({
      tenantId: tenant.id,
      saleId,
      method,
      amount,
    });

    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo registrar abono.",
      },
      { status: 400 }
    );
  }
}
