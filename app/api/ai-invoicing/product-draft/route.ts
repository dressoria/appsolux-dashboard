import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireAiInvoicingAccess } from "@/lib/core/require-ai-invoicing-access";
import { calculateSaleTotals } from "@/lib/core/sale-totals-calculator";
import { Prisma } from "@prisma/client";

type ItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number | string;
  discountAmount?: number | string;
  taxRate: number | string;
};

export async function POST(request: Request) {
  const access = await requireAiInvoicingAccess();
  if (!access.ok) return access.response;

  const body = (await request.json()) as Record<string, unknown>;
  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  const customerId =
    typeof body.customerId === "string" ? body.customerId.trim() || null : null;
  const paymentMethod =
    typeof body.paymentMethod === "string" ? body.paymentMethod : "transfer";
  const sriPaymentCode =
    typeof body.sriPaymentCode === "string" ? body.sriPaymentCode : "20";
  const items = Array.isArray(body.items) ? (body.items as ItemInput[]) : [];

  if (items.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Debes incluir al menos un producto." },
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
        { ok: false, error: "Cliente no encontrado." },
        { status: 404 },
      );
    }
  }

  const productIds = items.map((it) => it.productId);
  const products = await prisma.lightweightProduct.findMany({
    where: { id: { in: productIds }, tenantId: access.tenant.id },
    select: { id: true },
  });
  const validIds = new Set(products.map((p) => p.id));

  for (const item of items) {
    if (!validIds.has(item.productId)) {
      return NextResponse.json(
        { ok: false, error: `Producto no encontrado: ${item.productId}` },
        { status: 404 },
      );
    }
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "Cantidad debe ser mayor a 0." },
        { status: 400 },
      );
    }
  }

  const proposalItems = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: String(item.unitPrice),
    discountAmount: String(item.discountAmount ?? "0"),
    taxRate: String(item.taxRate),
  }));

  const calcLines = proposalItems.map((item) => ({
    quantity: item.quantity,
    unitPrice: new Prisma.Decimal(item.unitPrice),
    discountAmount: new Prisma.Decimal(item.discountAmount),
    taxRate: new Prisma.Decimal(item.taxRate),
  }));
  const totals = calculateSaleTotals(calcLines);

  const draft = await prisma.aiInvoiceDraft.create({
    data: {
      tenantId: access.tenant.id,
      createdByUserId: access.user.id,
      originalPrompt: `BY_PRODUCTS:${rawText}`,
      requestedAmount: totals.total,
      customerId,
      taxMode: "AUTO",
      paymentMethod,
      sriPaymentCode,
      status: "PROPOSED",
    },
  });

  const proposal = await prisma.aiInvoiceProposal.create({
    data: {
      tenantId: access.tenant.id,
      draftId: draft.id,
      proposalNumber: 1,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      items: proposalItems,
    },
  });

  await prisma.aiInvoiceDraft.update({
    where: { id: draft.id },
    data: { selectedProposalId: proposal.id },
  });

  return NextResponse.json(
    {
      ok: true,
      draft: {
        id: draft.id,
        status: draft.status,
        originalPrompt: draft.originalPrompt,
        requestedAmount: totals.total.toString(),
        paymentMethod: draft.paymentMethod,
        sriPaymentCode: draft.sriPaymentCode,
      },
      proposal: {
        id: proposal.id,
        proposalNumber: proposal.proposalNumber,
        subtotal: totals.subtotal.toString(),
        taxTotal: totals.taxTotal.toString(),
        total: totals.total.toString(),
        items: proposalItems,
      },
    },
    { status: 201 },
  );
}
