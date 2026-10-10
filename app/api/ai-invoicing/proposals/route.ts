import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";
import {
  generateProposals,
  type AiProductCandidate,
} from "@/lib/core/ai-invoice-proposal-engine";
import { Prisma } from "@prisma/client";

const VALID_TAX_MODES = new Set(["AUTO", "IVA_0", "IVA_15", "MIXED"]);

export async function POST(request: Request) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const body = (await request.json()) as Record<string, unknown>;
  const customerId = typeof body.customerId === "string" ? body.customerId.trim() : null;
  const rawAmount = body.requestedAmount;
  const taxMode = typeof body.taxMode === "string" ? body.taxMode : "AUTO";
  const originalPrompt = typeof body.originalPrompt === "string" ? body.originalPrompt.trim() : null;

  if (!VALID_TAX_MODES.has(taxMode)) {
    return NextResponse.json(
      { ok: false, error: "Modo IVA invalido." },
      { status: 400 },
    );
  }

  const requestedAmount = new Prisma.Decimal(
    typeof rawAmount === "number" ? rawAmount : typeof rawAmount === "string" ? rawAmount : 0,
  );

  if (requestedAmount.lte(0)) {
    return NextResponse.json(
      { ok: false, error: "El monto solicitado debe ser mayor a 0." },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();

  if (customerId) {
    const customer = await prisma.lightweightCustomer.findFirst({
      where: { id: customerId, tenantId: access.tenant.id },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente no encontrado o no pertenece a este tenant." },
        { status: 404 },
      );
    }
  }

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

  const proposals = generateProposals({
    products: candidates,
    requestedAmount,
    taxMode: taxMode as "AUTO" | "IVA_0" | "IVA_15" | "MIXED",
  });

  const draft = await prisma.aiInvoiceDraft.create({
    data: {
      tenantId: access.tenant.id,
      createdByUserId: access.user.id,
      originalPrompt: originalPrompt || null,
      requestedAmount,
      customerId: customerId || null,
      taxMode: taxMode as "AUTO" | "IVA_0" | "IVA_15" | "MIXED",
      status: proposals.length > 0 ? "PROPOSED" : "CREATED",
    },
  });

  const savedProposals = await Promise.all(
    proposals.map((proposal, index) =>
      prisma.aiInvoiceProposal.create({
        data: {
          tenantId: access.tenant.id,
          draftId: draft.id,
          proposalNumber: index + 1,
          subtotal: new Prisma.Decimal(proposal.subtotal),
          taxTotal: new Prisma.Decimal(proposal.taxTotal),
          total: new Prisma.Decimal(proposal.total),
          items: proposal.items,
          combinationHash: proposal.combinationHash,
        },
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    draft: {
      id: draft.id,
      status: draft.status,
      requestedAmount: draft.requestedAmount?.toString(),
      taxMode: draft.taxMode,
    },
    proposals: savedProposals.map((p) => ({
      id: p.id,
      proposalNumber: p.proposalNumber,
      subtotal: p.subtotal.toString(),
      taxTotal: p.taxTotal.toString(),
      total: p.total.toString(),
      items: p.items,
      combinationHash: p.combinationHash,
      difference: proposals[p.proposalNumber - 1]?.difference ?? "0.00",
    })),
  });
}
