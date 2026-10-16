import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";
import { createSale } from "@/lib/core/lightweight-pos";
import { startSriFlowFromBasicSale } from "@/lib/core/basic-sales-sri";
import { calculateSaleTotals } from "@/lib/core/sale-totals-calculator";
import { Prisma } from "@prisma/client";

type ProposalItem = {
  productId: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
};

function isPaymentMethod(v: string): v is "cash" | "transfer" | "card" | "credit" {
  return v === "cash" || v === "transfer" || v === "card" || v === "credit";
}

export async function POST(request: Request) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const body = (await request.json()) as Record<string, unknown>;
  const proposalIds = Array.isArray(body.proposalIds) ? body.proposalIds as string[] : [];

  if (proposalIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No hay propuestas para facturar." },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();

  const results: Array<{
    proposalId: string;
    ok: boolean;
    saleId?: string;
    error?: string;
    alreadyConverted?: boolean;
  }> = [];

  for (const proposalId of proposalIds) {
    const proposal = await prisma.aiInvoiceProposal.findFirst({
      where: { id: proposalId, tenantId: access.tenant.id },
      include: { draft: true },
    });

    if (!proposal) {
      results.push({ proposalId, ok: false, error: "Propuesta no encontrada." });
      continue;
    }

    const draft = proposal.draft;

    if (draft.status === "CONVERTED") {
      results.push({ proposalId, ok: true, saleId: draft.convertedSaleId ?? undefined, alreadyConverted: true });
      continue;
    }

    if (!["PROPOSED", "SAVED", "SELECTED"].includes(draft.status)) {
      results.push({ proposalId, ok: false, error: "Borrador no facturable." });
      continue;
    }

    if (!draft.requestedAmount) {
      results.push({ proposalId, ok: false, error: "Sin monto." });
      continue;
    }

    const items = proposal.items as ProposalItem[];
    const calcLines = items.map((item) => ({
      quantity: item.quantity,
      unitPrice: new Prisma.Decimal(item.unitPrice),
      discountAmount: new Prisma.Decimal(item.discountAmount ?? "0"),
      taxRate: new Prisma.Decimal(item.taxRate ?? "0"),
    }));
    const totals = calculateSaleTotals(calcLines);

    if (!totals.total.toDecimalPlaces(2).eq(draft.requestedAmount.toDecimalPlaces(2))) {
      results.push({ proposalId, ok: false, error: "PROPOSAL_TOTAL_MISMATCH" });
      continue;
    }

    const claimed = await prisma.aiInvoiceDraft.updateMany({
      where: { id: draft.id, status: { in: ["PROPOSED", "SAVED", "SELECTED"] } },
      data: { status: "CONVERTING" },
    });

    if (claimed.count === 0) {
      results.push({ proposalId, ok: false, error: "No se pudo reclamar." });
      continue;
    }

    const paymentMethod = draft.paymentMethod ?? "transfer";
    if (!isPaymentMethod(paymentMethod)) {
      await prisma.aiInvoiceDraft.update({ where: { id: draft.id }, data: { status: "PROPOSED" } });
      results.push({ proposalId, ok: false, error: "Método de pago inválido." });
      continue;
    }

    try {
      const sale = await createSale({
        tenantId: access.tenant.id,
        createdByUserId: access.user.id,
        customerId: draft.customerId ?? undefined,
        paymentMethod,
        paidAmount: Number(totals.total),
        sriPaymentCode: draft.sriPaymentCode ?? "20",
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discountAmount: Number(item.discountAmount ?? 0),
        })),
      });

      await prisma.aiInvoiceDraft.update({
        where: { id: draft.id },
        data: {
          status: "CONVERTED",
          convertedSaleId: sale.id,
          convertedAt: new Date(),
        },
      });

      try {
        await startSriFlowFromBasicSale({
          tenantId: access.tenant.id,
          saleId: sale.id,
          requestedByUserId: access.user.id,
        });
      } catch {
        // SRI failure doesn't rollback the sale
      }

      results.push({ proposalId, ok: true, saleId: sale.id });
    } catch (error) {
      await prisma.aiInvoiceDraft.update({
        where: { id: draft.id },
        data: { status: "PROPOSED" },
      });
      results.push({
        proposalId,
        ok: false,
        error: error instanceof Error ? error.message : "Error al crear venta.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
