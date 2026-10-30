import { NextRequest, NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

type Context = { params: Promise<{ noteId: string }> };

export async function GET(_: NextRequest, context: Context) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const { noteId } = await context.params;

  const note = await prisma.salesCreditNote.findFirst({
    where: { id: noteId, tenantId: tenant.id },
    include: {
      items: true,
      sourceSriDocument: {
        select: {
          id: true,
          customerName: true,
          customerIdentification: true,
          issuedAt: true,
          grandTotal: true,
          sequentialNumber: true,
          establishment: { select: { code: true } },
          issuePoint: { select: { code: true } },
        },
      },
    },
  });

  if (!note) return NextResponse.json({ error: "Nota de crédito no encontrada" }, { status: 404 });

  return NextResponse.json({ ok: true, note });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const { noteId } = await context.params;
  const body = await request.json();

  const note = await prisma.salesCreditNote.findFirst({
    where: { id: noteId, tenantId: tenant.id },
  });

  if (!note) return NextResponse.json({ error: "Nota de crédito no encontrada" }, { status: 404 });

  if (body.action === "cancel") {
    if (note.status === "AUTHORIZED") {
      return NextResponse.json({ error: "No se puede cancelar una NC autorizada." }, { status: 409 });
    }
    await prisma.salesCreditNote.update({ where: { id: noteId }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
