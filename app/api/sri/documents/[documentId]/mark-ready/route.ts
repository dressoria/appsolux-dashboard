import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriDocumentById } from "@/lib/core/sri";
import { getSriDocumentTechnicalChecklist } from "@/lib/core/sri-technical-checklist";
import { getPrismaClient } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const doc = await getSriDocumentById(tenant.id, documentId);

  if (!doc) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  if (doc.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Solo los borradores pueden marcarse como listos para pruebas." },
      { status: 422 }
    );
  }

  const checklist = await getSriDocumentTechnicalChecklist(tenant.id, documentId);
  if (!checklist) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  if (checklist.blockingIssues.length > 0) {
    return NextResponse.json(
      {
        error: "El comprobante tiene errores bloqueantes que deben resolverse primero.",
        blockingIssues: checklist.blockingIssues,
      },
      { status: 422 }
    );
  }

  const prisma = getPrismaClient();
  await prisma.sriDocument.update({
    where: { id: documentId },
    data: { status: "READY_FOR_TESTING" },
  });

  return NextResponse.json({ ok: true, status: "READY_FOR_TESTING" });
}
