import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const { productId } = await context.params;
    const prisma = getPrismaClient();

    const product = await prisma.lightweightProduct.findFirst({
      where: { id: productId, tenantId: tenant.id },
      select: {
        id: true,
        _count: { select: { saleItems: true, stockMovements: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ ok: false, message: "Producto no encontrado." }, { status: 404 });
    }

    if (product._count.saleItems > 0 || product._count.stockMovements > 0) {
      return NextResponse.json(
        { ok: false, message: "No se puede eliminar un producto con ventas o movimientos asociados." },
        { status: 400 }
      );
    }

    await prisma.lightweightProduct.delete({ where: { id: productId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo eliminar." },
      { status: 400 }
    );
  }
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
      taxRate: getNumber(body, "taxRate"),
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
