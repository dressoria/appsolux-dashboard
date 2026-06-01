import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriDocumentById, getSriProfile, getSriDocumentSequence } from "@/lib/core/sri";
import { runSriTechnicalChecklist } from "@/lib/core/sri-technical-checklist";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
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

  return NextResponse.json(checklist);
}
