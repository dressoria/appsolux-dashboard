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
  if (status && ["DRAFT", "CONFIRMED", "CONVERTED", "CANCELLED"].includes(status)) {
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
    where.OR = [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { identification: { contains: search, mode: "insensitive" } } },
      { observation: { contains: search, mode: "insensitive" } },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where: where as any,
      include: { customer: { select: { name: true, identification: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    prisma.salesOrder.count({ where: where as any }),
  ]);

  return NextResponse.json({
    ok: true,
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      issueDate: o.issueDate.toISOString(),
      customerName: o.customer?.name ?? "—",
      customerIdentification: o.customer?.identification ?? null,
      total: o.total.toString(),
      status: o.status,
      sellerName: o.sellerName,
      itemCount: o._count.items,
      convertedSaleId: o.convertedSaleId,
    })),
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

  const lastOrder = await prisma.salesOrder.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const nextNumber = (lastOrder?.number ?? 0) + 1;

  const items = (body.items ?? []).map((item: Record<string, unknown>) => ({
    productId: (item.productId as string) || null,
    code: (item.code as string) || null,
    productName: item.productName as string,
    description: (item.description as string) || null,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount ?? 0),
    taxRate: Number(item.taxRate ?? 0),
    taxCategory: (item.taxCategory as string) || null,
    subtotal: Number(item.subtotal),
    tax: Number(item.tax ?? 0),
    total: Number(item.total),
  }));

  let customerSnapshot = null;
  if (body.customerId) {
    const c = await prisma.lightweightCustomer.findFirst({
      where: { id: body.customerId, tenantId: tenant.id },
      select: { name: true, identification: true, email: true, phone: true, address: true },
    });
    if (c) customerSnapshot = c;
  }

  const order = await prisma.salesOrder.create({
    data: {
      tenantId: tenant.id,
      number: nextNumber,
      customerId: body.customerId || null,
      customerSnapshot: customerSnapshot ?? undefined,
      warehouseId: body.warehouseId || null,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      sellerName: body.sellerName || null,
      status: body.status === "CONFIRMED" ? "CONFIRMED" : "DRAFT",
      observation: body.observation || null,
      subtotal: Number(body.subtotal ?? 0),
      discount: Number(body.discount ?? 0),
      tax: Number(body.tax ?? 0),
      total: Number(body.total ?? 0),
      createdByUserId: user.id,
      items: { create: items },
    },
  });

  return NextResponse.json({ ok: true, id: order.id, number: nextNumber });
}
