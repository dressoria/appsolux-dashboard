import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteParams = { params: Promise<{ establishmentId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { establishmentId } = await params;

  // Validate establishment belongs to this tenant
  const prisma = getPrismaClient();
  const existing = await prisma.sriEstablishment.findFirst({
    where: { id: establishmentId, tenantId: tenant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Establecimiento no encontrado." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (typeof data.name === "string" && data.name.trim()) updates.name = data.name.trim();
  if (typeof data.address === "string" && data.address.trim()) updates.address = data.address.trim();
  if (typeof data.isActive === "boolean") updates.isActive = data.isActive;
  if (typeof data.isMain === "boolean") updates.isMain = data.isMain;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar." }, { status: 422 });
  }

  const establishment = await prisma.sriEstablishment.update({
    where: { id: establishmentId },
    data: updates,
  });

  return NextResponse.json({ establishment });
}
