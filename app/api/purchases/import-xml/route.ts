import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { importPurchaseXml } from "@/lib/core/purchase-xml-import";
import { getPrismaClient } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ ok: false, error: "Archivo XML requerido." }, { status: 400 });
  }

  const xmlString = await file.text();

  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId: tenant.id },
    select: { ruc: true },
  });

  const result = await importPurchaseXml(tenant.id, user.id, xmlString, profile?.ruc);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
