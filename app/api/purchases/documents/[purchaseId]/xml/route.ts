import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";
import { fetchAuthorizedXml } from "@/lib/core/sri-soap-client";

type RouteParams = { params: Promise<{ purchaseId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { tenant } = await requireDashboardSession();
  const { purchaseId } = await params;
  const prisma = getPrismaClient();

  const doc = await prisma.purchaseDocument.findFirst({
    where: { id: purchaseId, tenantId: tenant.id },
    select: { id: true, accessKey: true, supplierDocumentNumber: true, documentType: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  if (!doc.accessKey) {
    return NextResponse.json({ error: "Este documento no tiene clave de acceso." }, { status: 404 });
  }

  const result = await fetchAuthorizedXml(doc.accessKey);

  if (!result.authorized || !result.xml) {
    return NextResponse.json(
      { error: result.errors.join("; ") || `Estado: ${result.status}` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    xml: result.xml,
    accessKey: doc.accessKey,
    documentNumber: doc.supplierDocumentNumber,
    documentType: doc.documentType,
  });
}
