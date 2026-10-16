import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";
import {
  generateExactProposal,
  type AiProductCandidate,
} from "@/lib/core/ai-invoice-exact-solver";
import { Prisma } from "@prisma/client";

const VALID_TAX_MODES = new Set(["AUTO", "IVA_0", "IVA_15", "MIXED"]);

export async function POST(request: Request) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const body = (await request.json()) as Record<string, unknown>;
  const customerId = typeof body.customerId === "string" ? body.customerId.trim() : null;
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "transfer";
  const sriPaymentCode = typeof body.sriPaymentCode === "string" ? body.sriPaymentCode : "20";
  const requests = Array.isArray(body.requests) ? body.requests : [];

  if (requests.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Debes incluir al menos una factura." },
      { status: 400 },
    );
  }

  if (requests.length > 20) {
    return NextResponse.json(
      { ok: false, error: "Máximo 20 facturas por lote." },
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
    where: { tenantId: access.tenant.id, isActive: true },
    select: {
      id: true, name: true, primaryCode: true, auxiliaryCode: true,
      price: true, price2: true, price3: true, price4: true,
      taxRate: true, stock: true, trackInventory: true, type: true,
    },
  });

  const candidates: AiProductCandidate[] = products.map((p) => ({
    id: p.id, name: p.name, primaryCode: p.primaryCode, auxiliaryCode: p.auxiliaryCode,
    price: p.price, price2: p.price2, price3: p.price3, price4: p.price4 ?? null,
    taxRate: p.taxRate, stock: p.stock, trackInventory: p.trackInventory, type: p.type,
  }));

  const batchId = crypto.randomUUID();
  const drafts: Array<{
    draft: Record<string, unknown>;
    proposal: Record<string, unknown> | null;
    error?: string;
  }> = [];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i] as Record<string, unknown>;
    const rawAmount = req.requestedAmount;
    const taxMode = typeof req.taxMode === "string" && VALID_TAX_MODES.has(req.taxMode) ? req.taxMode : "AUTO";

    const requestedAmount = new Prisma.Decimal(
      typeof rawAmount === "number" ? rawAmount : typeof rawAmount === "string" ? rawAmount : 0,
    );

    if (requestedAmount.lte(0)) {
      drafts.push({ draft: { index: i }, proposal: null, error: "Monto debe ser mayor a 0." });
      continue;
    }

    const proposal = generateExactProposal({
      products: candidates,
      requestedAmount,
      taxMode: taxMode as "AUTO" | "IVA_0" | "IVA_15" | "MIXED",
      seed: hashCode(`${batchId}:${i}`),
    });

    const draft = await prisma.aiInvoiceDraft.create({
      data: {
        tenantId: access.tenant.id,
        createdByUserId: access.user.id,
        requestedAmount,
        customerId: customerId || null,
        taxMode: taxMode as "AUTO" | "IVA_0" | "IVA_15" | "MIXED",
        paymentMethod,
        sriPaymentCode,
        batchId,
        batchPosition: i + 1,
        status: proposal ? "PROPOSED" : "CREATED",
      },
    });

    let savedProposal = null;
    if (proposal) {
      savedProposal = await prisma.aiInvoiceProposal.create({
        data: {
          tenantId: access.tenant.id,
          draftId: draft.id,
          proposalNumber: 1,
          subtotal: new Prisma.Decimal(proposal.subtotal),
          taxTotal: new Prisma.Decimal(proposal.taxTotal),
          total: new Prisma.Decimal(proposal.total),
          items: proposal.items,
          combinationHash: proposal.combinationHash,
        },
      });

      await prisma.aiInvoiceDraft.update({
        where: { id: draft.id },
        data: { selectedProposalId: savedProposal.id },
      });
    }

    drafts.push({
      draft: {
        id: draft.id,
        status: draft.status,
        requestedAmount: draft.requestedAmount?.toString(),
        taxMode: draft.taxMode,
        batchPosition: draft.batchPosition,
        paymentMethod: draft.paymentMethod,
        sriPaymentCode: draft.sriPaymentCode,
      },
      proposal: savedProposal ? {
        id: savedProposal.id,
        proposalNumber: savedProposal.proposalNumber,
        subtotal: savedProposal.subtotal.toString(),
        taxTotal: savedProposal.taxTotal.toString(),
        total: savedProposal.total.toString(),
        items: savedProposal.items,
        combinationHash: savedProposal.combinationHash,
        isExact: true,
      } : null,
      error: !proposal ? "No fue posible generar una factura exacta para este monto." : undefined,
    });
  }

  return NextResponse.json({ ok: true, batchId, drafts });
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
