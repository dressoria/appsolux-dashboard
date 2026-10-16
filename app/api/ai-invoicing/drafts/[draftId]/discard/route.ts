import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";

type RouteParams = { params: Promise<{ draftId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const { draftId } = await params;
  const prisma = getPrismaClient();

  const draft = await prisma.aiInvoiceDraft.findFirst({
    where: {
      id: draftId,
      tenantId: access.tenant.id,
      createdByUserId: access.user.id,
    },
  });

  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "Borrador no encontrado." },
      { status: 404 },
    );
  }

  if (draft.status === "CONVERTED") {
    return NextResponse.json(
      { ok: false, error: "No se puede eliminar una factura ya emitida." },
      { status: 409 },
    );
  }

  await prisma.aiInvoiceDraft.update({
    where: { id: draftId },
    data: { status: "DISCARDED" },
  });

  return NextResponse.json({ ok: true, status: "DISCARDED" });
}
