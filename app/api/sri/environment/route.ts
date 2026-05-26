import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSriProfile } from "@/lib/core/sri";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);

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
  const environment = data.environment === "PRODUCTION" ? "PRODUCTION" : "TEST";

  const profile = await getSriProfile(tenant.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Configura primero la empresa y RUC antes de cambiar el ambiente." },
      { status: 422 }
    );
  }

  const prisma = getPrismaClient();
  const updated = await prisma.sriTaxpayerProfile.update({
    where: { tenantId: tenant.id },
    data: { environment },
  });

  return NextResponse.json({ environment: updated.environment });
}
