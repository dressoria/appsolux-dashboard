import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { validateInvoiceDraftSeller } from "@/lib/core/invoice-sellers";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    }
    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as { payload: unknown };
    if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
      return NextResponse.json({ ok: false, message: "Payload requerido." }, { status: 400 });
    }

    const payload = await validateInvoiceDraftSeller(tenant.id, user.id, body.payload);
    const prisma = getPrismaClient();
    const draft = await prisma.salesInvoiceDraft.create({
      data: {
        tenantId: tenant.id,
        createdByUserId: user.id,
        payload,
      },
    });

    return NextResponse.json({ ok: true, draft: { id: draft.id } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Error al crear borrador." },
      { status: 400 },
    );
  }
}
