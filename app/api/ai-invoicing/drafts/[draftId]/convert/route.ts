import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";

type RouteParams = { params: Promise<{ draftId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const { draftId } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const saleId = typeof body.saleId === "string" ? body.saleId : null;

  const prisma = getPrismaClient();

  await prisma.aiInvoiceDraft.updateMany({
    where: {
      id: draftId,
      tenantId: access.tenant.id,
      status: { not: "CONVERTED" },
    },
    data: {
      status: "CONVERTED",
      convertedSaleId: saleId,
      convertedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
