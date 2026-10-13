import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim() ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const paymentMethod = searchParams.get("paymentMethod");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const perPage = Math.min(50, Math.max(1, Number(searchParams.get("perPage") ?? 20)));

  const prisma = getPrismaClient();

  const sriSaleIds = await prisma.sriDocument.findMany({
    where: { tenantId: tenant.id, sourceType: "BASIC_SALE", sourceId: { not: null } },
    select: { sourceId: true },
  }).then((docs) => docs.map((d) => d.sourceId).filter((id): id is string => id !== null));

  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    id: sriSaleIds.length > 0 ? { notIn: sriSaleIds } : undefined,
  };

  if (status && ["open", "paid", "canceled"].includes(status)) {
    where.status = status;
  }

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      createdAt.gte = new Date(`${from}T00:00:00.000-05:00`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      createdAt.lte = new Date(`${to}T23:59:59.999-05:00`);
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  }

  if (q) {
    where.OR = [
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { identification: { contains: q, mode: "insensitive" } } },
      { id: { contains: q } },
    ];
  }

  if (paymentMethod) {
    where.payments = { some: { method: paymentMethod } };
  }

  const [sales, total] = await Promise.all([
    prisma.lightweightSale.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, identification: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.lightweightSale.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    sales: sales.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      customerName: s.customer?.name ?? "Consumidor final",
      customerIdentification: s.customer?.identification ?? null,
      subtotal: s.subtotal.toString(),
      taxTotal: s.taxTotal.toString(),
      total: s.total.toString(),
      status: s.status,
      paymentStatus: s.paymentStatus,
      paymentMethods: [...new Set(s.payments.map((p) => p.method))],
      origin: s.origin,
      itemCount: s.items.length,
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  });
}
