import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriDocumentById, getSriProfile, getSriDocumentSequence } from "@/lib/core/sri";
import { runSriTechnicalChecklist } from "@/lib/core/sri-technical-checklist";
import { getPrismaClient } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const [doc, profile] = await Promise.all([
    getSriDocumentById(tenant.id, documentId),
    getSriProfile(tenant.id),
  ]);

  if (!doc) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  if (doc.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Solo los borradores pueden marcarse como listos para pruebas." },
      { status: 422 }
    );
  }

  const sequence = await getSriDocumentSequence(
    tenant.id,
    doc.establishmentId,
    doc.issuePointId
  );

  const checklist = runSriTechnicalChecklist({
    documentId: doc.id,
    document: {
      documentType: doc.documentType,
      status: doc.status,
      grandTotal: doc.grandTotal.toString(),
      sequentialNumber: doc.sequentialNumber,
      customerName: doc.customerName,
      customerIdentification: doc.customerIdentification,
      customerEmail: doc.customerEmail,
      issuedAt: doc.issuedAt,
      createdAt: doc.createdAt,
    },
    lines: doc.lines.map((l) => ({
      itemName: l.itemName,
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
    })),
    profile: profile
      ? {
          ruc: profile.ruc,
          legalName: profile.legalName,
          environment: profile.environment,
        }
      : null,
    establishment: { code: doc.establishment.code, name: doc.establishment.name },
    issuePoint: { code: doc.issuePoint.code },
    sequence: sequence ? { isActive: sequence.isActive, currentNumber: sequence.currentNumber } : null,
  });

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
