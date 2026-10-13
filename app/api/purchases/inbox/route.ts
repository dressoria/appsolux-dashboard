import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? undefined;

  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (status) where.status = status;

  const items = await prisma.purchaseInboxItem.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido." }, { status: 400 });

  await prisma.purchaseInboxItem.updateMany({
    where: { id: body.id, tenantId: tenant.id },
    data: {
      status: body.status ?? undefined,
      suggestedCategory: body.suggestedCategory ?? undefined,
      suggestedDeductibility: body.suggestedDeductibility ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
