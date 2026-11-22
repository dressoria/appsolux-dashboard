import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { gateModuleApiAccess } from "@/lib/core/capabilities";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const gate = await gateModuleApiAccess(tenant.id, "purchases");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const prisma = getPrismaClient();
  const codes = await prisma.taxWithholdingCode.findMany({
    where: { isActive: true },
    orderBy: [{ taxType: "asc" }, { code: "asc" }],
  });

  return NextResponse.json(codes);
}
