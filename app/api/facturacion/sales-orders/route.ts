import type { Prisma } from "@prisma/client";
import { createSalesOrder, SalesDocumentError } from "@/lib/core/sales-documents";
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

  const where: Prisma.SalesOrderWhereInput = { tenantId: tenant.id };
  if (status && ["DRAFT", "CONFIRMED", "CONVERTED", "CANCELLED"].includes(status)) {
    where.status = status as Prisma.SalesOrderWhereInput["status"];
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

  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where: where,
      include: { customer: { select: { name: true, identification: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    prisma.salesOrder.count({ where: where }),
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
  try {
    return NextResponse.json(await createSalesOrder(tenant.id, user.id, await request.json()));
  } catch (error) {
    if (error instanceof SalesDocumentError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
