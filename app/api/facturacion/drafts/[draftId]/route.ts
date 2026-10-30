import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
  }
  const tenant = await getCurrentTenant(user);
  const { draftId } = await params;
  const prisma = getPrismaClient();

  const draft = await prisma.salesInvoiceDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, status: "DRAFT" },
  });
  if (!draft) {
    return NextResponse.json({ ok: false, message: "Borrador no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, draft });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    }
    const tenant = await getCurrentTenant(user);
    const { draftId } = await params;
    const body = (await request.json()) as { payload?: unknown; status?: string; convertedSaleId?: string };
    const prisma = getPrismaClient();

    const existing = await prisma.salesInvoiceDraft.findFirst({
      where: { id: draftId, tenantId: tenant.id },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, message: "Borrador no encontrado." }, { status: 404 });
    }
    if (existing.status === "CONVERTED") {
      return NextResponse.json({ ok: false, message: "Borrador ya convertido.", convertedSaleId: existing.convertedSaleId }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (body.payload && typeof body.payload === "object") {
      data.payload = body.payload;
    }
    if (body.status === "CONVERTED" && typeof body.convertedSaleId === "string") {
      data.status = "CONVERTED";
      data.convertedSaleId = body.convertedSaleId;
    }
    if (body.status === "CANCELLED") {
      data.status = "CANCELLED";
    }

    const updated = await prisma.salesInvoiceDraft.update({
      where: { id: draftId },
      data,
    });

    return NextResponse.json({ ok: true, draft: { id: updated.id, status: updated.status } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Error al actualizar borrador." },
      { status: 400 },
    );
  }
}
