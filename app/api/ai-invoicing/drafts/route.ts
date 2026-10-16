import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";

export async function GET() {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const prisma = getPrismaClient();

  const drafts = await prisma.aiInvoiceDraft.findMany({
    where: {
      tenantId: access.tenant.id,
      createdByUserId: access.user.id,
      status: { in: ["PROPOSED", "SAVED", "CREATED"] },
    },
    include: {
      customer: { select: { id: true, name: true, identification: true } },
      proposals: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const recentConverted = await prisma.aiInvoiceDraft.findMany({
    where: {
      tenantId: access.tenant.id,
      createdByUserId: access.user.id,
      status: "CONVERTED",
    },
    include: {
      customer: { select: { id: true, name: true, identification: true } },
    },
    orderBy: { convertedAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    ok: true,
    drafts: drafts.map((d) => ({
      id: d.id,
      status: d.status,
      requestedAmount: d.requestedAmount?.toString(),
      taxMode: d.taxMode,
      paymentMethod: d.paymentMethod,
      sriPaymentCode: d.sriPaymentCode,
      batchId: d.batchId,
      batchPosition: d.batchPosition,
      customer: d.customer,
      selectedProposalId: d.selectedProposalId,
      savedAt: d.savedAt,
      createdAt: d.createdAt,
      activeProposal: d.proposals[0] ? {
        id: d.proposals[0].id,
        proposalNumber: d.proposals[0].proposalNumber,
        subtotal: d.proposals[0].subtotal.toString(),
        taxTotal: d.proposals[0].taxTotal.toString(),
        total: d.proposals[0].total.toString(),
        items: d.proposals[0].items,
        combinationHash: d.proposals[0].combinationHash,
      } : null,
    })),
    recentConverted: recentConverted.map((d) => ({
      id: d.id,
      requestedAmount: d.requestedAmount?.toString(),
      customer: d.customer,
      convertedSaleId: d.convertedSaleId,
      convertedAt: d.convertedAt,
    })),
  });
}
