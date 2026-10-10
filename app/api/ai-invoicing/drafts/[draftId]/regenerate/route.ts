import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";
import {
  generateProposals,
  type AiProductCandidate,
} from "@/lib/core/ai-invoice-proposal-engine";
import { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ draftId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const { draftId } = await params;
  const prisma = getPrismaClient();

  const draft = await prisma.aiInvoiceDraft.findFirst({
    where: { id: draftId, tenantId: access.tenant.id },
    include: {
      proposals: { select: { combinationHash: true } },
    },
  });

  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "Borrador no encontrado." },
      { status: 404 },
    );
  }

  if (!draft.requestedAmount || draft.requestedAmount.lte(0)) {
    return NextResponse.json(
      { ok: false, error: "El borrador no tiene monto valido." },
      { status: 400 },
    );
  }

  const excludedHashes = new Set(
    draft.proposals
      .map((p) => p.combinationHash)
      .filter((h): h is string => h !== null),
  );

  const products = await prisma.lightweightProduct.findMany({
    where: {
      tenantId: access.tenant.id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      primaryCode: true,
      auxiliaryCode: true,
      price: true,
      price2: true,
      price3: true,
      taxRate: true,
      stock: true,
      trackInventory: true,
      type: true,
    },
  });

  const candidates: AiProductCandidate[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    primaryCode: p.primaryCode,
    auxiliaryCode: p.auxiliaryCode,
    price: p.price,
    price2: p.price2,
    price3: p.price3,
    taxRate: p.taxRate,
    stock: p.stock,
    trackInventory: p.trackInventory,
    type: p.type,
  }));

  const newProposals = generateProposals({
    products: candidates,
    requestedAmount: draft.requestedAmount,
    taxMode: draft.taxMode,
    excludedHashes,
  });

  const existingCount = draft.proposals.length;

  const savedProposals = await Promise.all(
    newProposals.map((proposal, index) =>
      prisma.aiInvoiceProposal.create({
        data: {
          tenantId: access.tenant.id,
          draftId: draft.id,
          proposalNumber: existingCount + index + 1,
          subtotal: new Prisma.Decimal(proposal.subtotal),
          taxTotal: new Prisma.Decimal(proposal.taxTotal),
          total: new Prisma.Decimal(proposal.total),
          items: proposal.items,
          combinationHash: proposal.combinationHash,
        },
      }),
    ),
  );

  if (newProposals.length > 0) {
    await prisma.aiInvoiceDraft.update({
      where: { id: draft.id },
      data: { status: "PROPOSED" },
    });
  }

  return NextResponse.json({
    ok: true,
    proposals: savedProposals.map((p, i) => ({
      id: p.id,
      proposalNumber: p.proposalNumber,
      subtotal: p.subtotal.toString(),
      taxTotal: p.taxTotal.toString(),
      total: p.total.toString(),
      items: p.items,
      combinationHash: p.combinationHash,
      difference: newProposals[i]?.difference ?? "0.00",
    })),
  });
}
