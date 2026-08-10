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

function getBoolean(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "boolean" ? body[key] as boolean : undefined;
}

function getComboItems(body: Record<string, unknown>) {
  if (!Array.isArray(body.comboItems)) return undefined;
  return body.comboItems.map((item) => {
    const value = item as Record<string, unknown>;
    return { componentProductId: String(value.componentProductId ?? ""), quantity: Number(value.quantity) };
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const { searchParams } = new URL(request.url);
  const products = await listProducts(tenant.id, {
    search: searchParams.get("q") ?? undefined,
    type: (searchParams.get("type") || undefined) as never,
    status: (searchParams.get("status") || undefined) as "active" | "inactive" | undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    stock: (searchParams.get("stock") || undefined) as "low" | "out" | undefined,
  });

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
      type: (getString(body, "type") || "PRODUCT") as never,
      primaryCode: getString(body, "primaryCode"),
      auxiliaryCode: getString(body, "auxiliaryCode") || undefined,
      description: getString(body, "description") || undefined,
      price: getNumber(body, "price") ?? 0,
      price2: getNumber(body, "price2"),
      price3: getNumber(body, "price3"),
      cost: getNumber(body, "cost"),
      isActive: getBoolean(body, "isActive"),
      trackInventory: getBoolean(body, "trackInventory"),
      unit: (getString(body, "unit") || "UNIT") as never,
      categoryId: getString(body, "categoryId") || undefined,
      stock: getNumber(body, "stock"),
      minStock: getNumber(body, "minStock"),
      barcode: getString(body, "barcode") || undefined,
      expiresAt: getString(body, "expiresAt")
        ? new Date(getString(body, "expiresAt"))
        : undefined,
      taxRate: getNumber(body, "taxRate"),
      iceEnabled: getBoolean(body, "iceEnabled"),
      iceCode: getString(body, "iceCode") || undefined,
      iceRate: getNumber(body, "iceRate"),
      comboItems: getComboItems(body),
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
