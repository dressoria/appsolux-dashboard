import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const categories = await getPrismaClient().lightweightProductCategory.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, categories });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    const tenant = await getCurrentTenant(user);
    await requireTenantOperationalAccess(tenant.id);
    const body = await request.json() as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new Error("El nombre de la categoria es requerido.");
    const prisma = getPrismaClient();
    const duplicate = await prisma.lightweightProductCategory.findFirst({
      where: { tenantId: tenant.id, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) throw new Error("Ya existe una categoria con ese nombre.");
    const category = await prisma.lightweightProductCategory.create({ data: { tenantId: tenant.id, name } });
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "No se pudo crear la categoria." }, { status: 400 });
  }
}
