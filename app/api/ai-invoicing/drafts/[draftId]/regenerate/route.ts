import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";
import {
  generateExactProposal,
  type AiProductCandidate,
} from "@/lib/core/ai-invoice-exact-solver";
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
      price4: true,
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
    price4: p.price4 ?? null,
    taxRate: p.taxRate,
    stock: p.stock,
    trackInventory: p.trackInventory,
    type: p.type,
  }));

  const generationNumber = draft.proposals.length + 1;
  const seed = hashCode(`${draftId}:${generationNumber}`);

  const proposal = generateExactProposal({
    products: candidates,
    requestedAmount: draft.requestedAmount,
    taxMode: draft.taxMode,
    excludedHashes,
    seed,
  });

  if (!proposal) {
    return NextResponse.json({
      ok: false,
      error: "No fue posible generar otra combinación exacta con los productos, IVA y stock disponibles.",
    }, { status: 422 });
  }

  const savedProposal = await prisma.aiInvoiceProposal.create({
    data: {
      tenantId: access.tenant.id,
      draftId: draft.id,
      proposalNumber: generationNumber,
      subtotal: new Prisma.Decimal(proposal.subtotal),
      taxTotal: new Prisma.Decimal(proposal.taxTotal),
      total: new Prisma.Decimal(proposal.total),
      items: proposal.items,
      combinationHash: proposal.combinationHash,
    },
  });

  await prisma.aiInvoiceDraft.update({
    where: { id: draft.id },
    data: {
      selectedProposalId: savedProposal.id,
      status: "PROPOSED",
    },
  });

  return NextResponse.json({
    ok: true,
    proposal: {
      id: savedProposal.id,
      proposalNumber: savedProposal.proposalNumber,
      subtotal: savedProposal.subtotal.toString(),
      taxTotal: savedProposal.taxTotal.toString(),
      total: savedProposal.total.toString(),
      items: savedProposal.items,
      combinationHash: savedProposal.combinationHash,
      isExact: true,
    },
  });
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
