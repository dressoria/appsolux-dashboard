import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { updateProduct } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function getNumber(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }

  return undefined;
}

export async function PATCH(request: Request, context: RouteContext) {
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
    const expiresAt = getString(body, "expiresAt");
    const product = await updateProduct({
      tenantId: tenant.id,
      productId,
      name: getString(body, "name"),
      price: getNumber(body, "price"),
      cost: getNumber(body, "cost"),
      minStock: getNumber(body, "minStock"),
      barcode: getString(body, "barcode"),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo actualizar.",
      },
      { status: 400 }
    );
  }
}
