import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    }
    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as { payload: unknown };
    if (!body.payload || typeof body.payload !== "object") {
      return NextResponse.json({ ok: false, message: "Payload requerido." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const draft = await prisma.salesInvoiceDraft.create({
      data: {
        tenantId: tenant.id,
        createdByUserId: user.id,
        payload: body.payload as object,
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
