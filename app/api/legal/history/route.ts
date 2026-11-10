import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { assertContractOwner, legalErrorResponse } from "@/lib/legal/service";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const tenant = await getCurrentTenant(user);
    const db = getPrismaClient();
    await assertContractOwner(db, user.id, tenant.id);
    const acceptances = await db.legalAcceptance.findMany({ where: { tenantId: tenant.id }, orderBy: { acceptedAt: "desc" }, take: 100, select: { id: true, userId: true, releaseHash: true, context: true, planCode: true, billingInterval: true, operationReference: true, acceptedAt: true, documents: true, release: { select: { version: true, documents: { select: { type: true, version: true, title: true, content: true, hash: true } } } } } });
    return NextResponse.json({ ok: true, acceptances }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ ok: false }, { status: legalErrorResponse(error)?.status ?? 503 }); }
}
