import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";

type RouteParams = { params: Promise<{ proposalId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const { proposalId } = await params;
  const prisma = getPrismaClient();

  const proposal = await prisma.aiInvoiceProposal.findFirst({
    where: { id: proposalId, tenantId: access.tenant.id },
    select: { id: true, draftId: true },
  });

  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: "Propuesta no encontrada." },
      { status: 404 },
    );
  }

  const draft = await prisma.aiInvoiceDraft.findFirst({
    where: { id: proposal.draftId, tenantId: access.tenant.id },
    select: { id: true },
  });

  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "Borrador no encontrado." },
      { status: 404 },
    );
  }

  await prisma.aiInvoiceDraft.update({
    where: { id: draft.id },
    data: {
      selectedProposalId: proposal.id,
      status: "SELECTED",
    },
  });

  return NextResponse.json({
    ok: true,
    draftId: draft.id,
    selectedProposalId: proposal.id,
    status: "SELECTED",
  });
}
