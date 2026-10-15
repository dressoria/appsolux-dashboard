import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();
  const categories = await prisma.lightweightProductCategory.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });

  const prisma = getPrismaClient();
  if (body.id) {
    const cat = await prisma.lightweightProductCategory.update({
      where: { id: body.id, tenantId: tenant.id },
      data: { name: body.name },
    });
    return NextResponse.json(cat);
  }
  const cat = await prisma.lightweightProductCategory.create({
    data: { tenantId: tenant.id, name: body.name },
  });
  return NextResponse.json(cat, { status: 201 });
}
