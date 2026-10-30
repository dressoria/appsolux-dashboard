import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export async function GET(request: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const url = request.nextUrl;

  const search = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const perPageRaw = Number(url.searchParams.get("perPage") ?? "10");
  const perPage = [10, 20, 50, 100].includes(perPageRaw) ? perPageRaw : 10;

  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (status && ["DRAFT", "PENDING_SRI", "AUTHORIZED", "REJECTED", "CANCELLED"].includes(status)) {
    where.status = status;
  }
  if (from) {
    const fromDate = new Date(`${from}T00:00:00.000-05:00`);
    if (!isNaN(fromDate.getTime())) where.issueDate = { ...(where.issueDate as object ?? {}), gte: fromDate };
  }
  if (to) {
    const toDate = new Date(`${to}T23:59:59.999-05:00`);
    if (!isNaN(toDate.getTime())) where.issueDate = { ...(where.issueDate as object ?? {}), lte: toDate };
  }
  if (search) {
    where.reason = { contains: search, mode: "insensitive" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [notes, total] = await Promise.all([
    prisma.salesCreditNote.findMany({
      where: where as any,
      include: {
        sourceSriDocument: {
          select: {
            customerName: true,
            customerIdentification: true,
            sequentialNumber: true,
            establishment: { select: { code: true } },
            issuePoint: { select: { code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    prisma.salesCreditNote.count({ where: where as any }),
  ]);

  return NextResponse.json({
    ok: true,
    notes: notes.map((n) => {
      const snap = (n.customerSnapshot ?? {}) as Record<string, string | null>;
      const src = n.sourceSriDocument;
      const srcNum = src.sequentialNumber
        ? `${src.establishment?.code ?? "???"}-${src.issuePoint?.code ?? "???"}-${String(src.sequentialNumber).padStart(9, "0")}`
        : null;
      return {
        id: n.id,
        number: n.number,
        issueDate: n.issueDate.toISOString(),
        customerName: snap.name ?? src.customerName ?? "—",
        customerIdentification: snap.identification ?? src.customerIdentification ?? null,
        total: n.total.toString(),
        status: n.status,
        type: n.creditNoteType,
        reason: n.reason,
        sourceInvoiceNumber: srcNum,
      };
    }),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  });
}

export async function POST(request: NextRequest) {
  const { user, tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const body = await request.json();

  const sourceSriDocId = body.sourceSriDocumentId;
  if (!sourceSriDocId) {
    return NextResponse.json({ error: "Factura de origen requerida." }, { status: 400 });
  }

  const sourceDoc = await prisma.sriDocument.findFirst({
    where: { id: sourceSriDocId, tenantId: tenant.id, status: "AUTHORIZED", documentType: "INVOICE" },
  });
  if (!sourceDoc) {
    return NextResponse.json({ error: "La factura de origen debe estar AUTORIZADA y pertenecer al tenant." }, { status: 400 });
  }

  const lastNote = await prisma.salesCreditNote.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (lastNote?.number ?? 0) + 1;

  const items = (body.items ?? []).map((item: Record<string, unknown>) => ({
    productId: (item.productId as string) || null,
    code: (item.code as string) || null,
    productName: (item.productName as string) ?? "—",
    description: (item.description as string) || null,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount ?? 0),
    taxRate: Number(item.taxRate ?? 0),
    taxCategory: (item.taxCategory as string) || null,
    taxAmount: Number(item.tax ?? 0),
    subtotal: Number(item.subtotal),
    total: Number(item.total),
    maxQuantity: Number(item.quantity),
  }));

  const customerSnapshot = {
    name: body.customerName ?? "Consumidor Final",
    identification: body.customerIdentification ?? null,
    email: body.customerEmail ?? null,
    address: body.customerAddress ?? null,
  };

  const note = await prisma.salesCreditNote.create({
    data: {
      tenantId: tenant.id,
      number: nextNumber,
      sourceSriDocumentId: sourceSriDocId,
      creditNoteType: body.type ?? "RETURN",
      reason: body.reason ?? "Devolución de mercadería",
      customerSnapshot,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      status: "DRAFT",
      subtotal: Number(body.subtotal ?? 0),
      tax: Number(body.tax ?? 0),
      total: Number(body.total ?? 0),
      createdByUserId: user.id,
      items: { create: items },
    },
  });

  return NextResponse.json({ ok: true, id: note.id, number: nextNumber });
}
