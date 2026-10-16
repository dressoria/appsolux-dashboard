import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";
import { createSale } from "@/lib/core/lightweight-pos";
import { startSriFlowFromBasicSale } from "@/lib/core/basic-sales-sri";
import { calculateSaleTotals } from "@/lib/core/sale-totals-calculator";
import { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ proposalId: string }> };

type ProposalItem = {
  productId: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
};

function isPaymentMethod(v: string): v is "cash" | "transfer" | "card" | "credit" {
  return v === "cash" || v === "transfer" || v === "card" || v === "credit";
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const { proposalId } = await params;
  const prisma = getPrismaClient();

  const proposal = await prisma.aiInvoiceProposal.findFirst({
    where: { id: proposalId, tenantId: access.tenant.id },
    include: {
      draft: true,
    },
  });

  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: "Propuesta no encontrada." },
      { status: 404 },
    );
  }

  const draft = proposal.draft;

  if (draft.status === "CONVERTED") {
    return NextResponse.json({
      ok: true,
      alreadyConverted: true,
      saleId: draft.convertedSaleId,
    });
  }

  if (draft.status === "CONVERTING") {
    return NextResponse.json(
      { ok: false, error: "Esta factura ya se está procesando." },
      { status: 409 },
    );
  }

  if (!["PROPOSED", "SAVED", "SELECTED"].includes(draft.status)) {
    return NextResponse.json(
      { ok: false, error: "Este borrador no puede facturarse." },
      { status: 409 },
    );
  }

  const items = proposal.items as ProposalItem[];
  if (!draft.requestedAmount) {
    return NextResponse.json(
      { ok: false, error: "El borrador no tiene monto." },
      { status: 400 },
    );
  }

  const calcLines = items.map((item) => ({
    quantity: item.quantity,
    unitPrice: new Prisma.Decimal(item.unitPrice),
    discountAmount: new Prisma.Decimal(item.discountAmount ?? "0"),
    taxRate: new Prisma.Decimal((item as Record<string, unknown>).taxRate as string ?? "0"),
  }));
  const totals = calculateSaleTotals(calcLines);

  if (!totals.total.toDecimalPlaces(2).eq(draft.requestedAmount.toDecimalPlaces(2))) {
    return NextResponse.json(
      { ok: false, error: "PROPOSAL_TOTAL_MISMATCH: El total de la propuesta no coincide con el monto solicitado." },
      { status: 409 },
    );
  }

  const claimed = await prisma.aiInvoiceDraft.updateMany({
    where: {
      id: draft.id,
      tenantId: access.tenant.id,
      status: { in: ["PROPOSED", "SAVED", "SELECTED"] },
    },
    data: { status: "CONVERTING" },
  });

  if (claimed.count === 0) {
    return NextResponse.json(
      { ok: false, error: "No se pudo reclamar el borrador. Puede que otro proceso lo esté facturando." },
      { status: 409 },
    );
  }

  const paymentMethod = draft.paymentMethod ?? "transfer";
  if (!isPaymentMethod(paymentMethod)) {
    await prisma.aiInvoiceDraft.update({ where: { id: draft.id }, data: { status: "PROPOSED" } });
    return NextResponse.json(
      { ok: false, error: "Método de pago inválido." },
      { status: 400 },
    );
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

    let sriResult = null;
    try {
      sriResult = await startSriFlowFromBasicSale({
        tenantId: access.tenant.id,
        saleId: sale.id,
        requestedByUserId: access.user.id,
      });
    } catch (sriError) {
      sriResult = {
        error: sriError instanceof Error ? sriError.message : "Error al iniciar flujo SRI.",
      };
    }

    return NextResponse.json({
      ok: true,
      saleId: sale.id,
      sri: sriResult,
    });
  } catch (error) {
    await prisma.aiInvoiceDraft.update({
      where: { id: draft.id },
      data: { status: "PROPOSED" },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al crear la venta.",
      },
      { status: 500 },
    );
  }
}
