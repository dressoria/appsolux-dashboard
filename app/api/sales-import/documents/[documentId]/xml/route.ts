import { NextRequest, NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { tenant } = await requireDashboardSession();
  const { documentId } = await params;
  const prisma = getPrismaClient();

  const doc = await prisma.externalSalesDocument.findFirst({
    where: { id: documentId, tenantId: tenant.id },
    select: {
      id: true,
      accessKey: true,
      documentNumber: true,
      documentType: true,
      rawPayload: true,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  const payload = doc.rawPayload as Record<string, unknown> | null;
  const xml = typeof payload?.xml === "string" ? payload.xml : null;

  if (!xml) {
    return NextResponse.json({ error: "XML no disponible para este documento." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    xml,
    accessKey: doc.accessKey,
    documentNumber: doc.documentNumber,
    documentType: doc.documentType,
  });
}
