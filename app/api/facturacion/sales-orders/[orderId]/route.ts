import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

type Context = { params: Promise<{ orderId: string }> };

export async function GET(_: NextRequest, context: Context) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const { orderId } = await context.params;

  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, tenantId: tenant.id },
    include: {
      customer: { select: { name: true, identification: true, email: true, phone: true, address: true } },
      items: { include: { product: { select: { name: true, primaryCode: true } } } },
    },
  });

  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  return NextResponse.json({ ok: true, order });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { user, tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const { orderId } = await context.params;
  const body = await request.json();

  const order = await prisma.salesOrder.findFirst({
    where: { id: orderId, tenantId: tenant.id },
    include: { items: true },
  });

  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  if (body.action === "confirm") {
    if (order.status !== "DRAFT") {
      return NextResponse.json({ error: "Solo órdenes en borrador pueden confirmarse" }, { status: 409 });
    }
    await prisma.salesOrder.update({ where: { id: orderId }, data: { status: "CONFIRMED" } });
    return NextResponse.json({ ok: true, status: "CONFIRMED" });
  }

  if (body.action === "cancel") {
    if (order.status === "CONVERTED") {
      return NextResponse.json({ error: "Orden ya convertida, no se puede cancelar" }, { status: 409 });
    }
    await prisma.salesOrder.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  }

  if (body.action === "convert") {
    if (order.status === "CONVERTED") {
      return NextResponse.json({ error: "Orden ya convertida", convertedSaleId: order.convertedSaleId }, { status: 409 });
    }
    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Orden cancelada, no se puede convertir" }, { status: 409 });
    }

    const draftPayload = {
      customerId: order.customerId,
      warehouseId: order.warehouseId,
      observation: order.observation,
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        price: Number(item.unitPrice),
        discountAmount: Number(item.discount),
        taxRate: Number(item.taxRate),
        description: item.description,
      })),
      sourceOrderId: order.id,
    };

    const draft = await prisma.salesInvoiceDraft.create({
      data: {
        tenantId: tenant.id,
        createdByUserId: user.id,
        payload: draftPayload,
      },
    });

    return NextResponse.json({ ok: true, draftId: draft.id });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
