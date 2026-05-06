import { LightweightPaymentMethod } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createSale, listSales } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function isPaymentMethod(value: unknown): value is LightweightPaymentMethod {
  return (
    value === "cash" ||
    value === "transfer" ||
    value === "card" ||
    value === "credit"
  );
}

function readItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      productId: typeof row.productId === "string" ? row.productId : "",
      quantity:
        typeof row.quantity === "number"
          ? row.quantity
          : Number(row.quantity ?? 0),
    };
  });
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const sales = await listSales(tenant.id);

  return NextResponse.json({ ok: true, sales });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const method = body.paymentMethod;

    if (!isPaymentMethod(method)) {
      throw new Error("Metodo de pago invalido.");
    }

    const sale = await createSale({
      tenantId: tenant.id,
      customerId:
        typeof body.customerId === "string" && body.customerId
          ? body.customerId
          : undefined,
      paymentMethod: method,
      paidAmount:
        typeof body.paidAmount === "number"
          ? body.paidAmount
          : Number(body.paidAmount ?? 0),
      items: readItems(body.items),
    });

    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear venta.",
      },
      { status: 400 }
    );
  }
}
