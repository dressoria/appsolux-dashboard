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
      status: { in: ["PROPOSED", "CREATED"] },
    },
  });

  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "Borrador no encontrado o no se puede guardar." },
      { status: 404 },
    );
  }

  await prisma.aiInvoiceDraft.update({
    where: { id: draftId },
    data: { status: "SAVED", savedAt: new Date() },
  });

  return NextResponse.json({ ok: true, status: "SAVED" });
}
