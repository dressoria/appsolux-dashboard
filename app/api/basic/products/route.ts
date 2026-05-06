import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createProduct, listProducts } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
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

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const products = await listProducts(tenant.id);

  return NextResponse.json({ ok: true, products });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const product = await createProduct({
      tenantId: tenant.id,
      name: getString(body, "name"),
      price: getNumber(body, "price") ?? 0,
      cost: getNumber(body, "cost"),
      stock: getNumber(body, "stock"),
      minStock: getNumber(body, "minStock"),
      barcode: getString(body, "barcode") || undefined,
      expiresAt: getString(body, "expiresAt")
        ? new Date(getString(body, "expiresAt"))
        : undefined,
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear producto.",
      },
      { status: 400 }
    );
  }
}
