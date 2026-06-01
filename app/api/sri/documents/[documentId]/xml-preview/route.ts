import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { buildUnsignedSriInvoiceXmlPreview } from "@/lib/core/sri-xml";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const prisma = getPrismaClient();

  const doc = await prisma.sriDocument.findFirst({
    where: { id: documentId, tenantId: tenant.id },
    include: {
      establishment: true,
      issuePoint: true,
      lines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  if (doc.status !== "DRAFT" && doc.status !== "READY_FOR_TESTING") {
    return NextResponse.json(
      { error: "Solo se puede generar vista previa de comprobantes en estado borrador." },
      { status: 422 }
    );
  }

  const [profile, sequence] = await Promise.all([
    prisma.sriTaxpayerProfile.findUnique({ where: { tenantId: tenant.id } }),
    prisma.sriDocumentSequence.findFirst({
      where: {
        tenantId: tenant.id,
        establishmentId: doc.establishmentId,
        issuePointId: doc.issuePointId,
        documentType: "INVOICE",
        isActive: true,
      },
    }),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "Perfil SRI no configurado." }, { status: 422 });
  }

  const sequentialNumber = doc.sequentialNumber ?? sequence?.currentNumber ?? 1;

  const result = buildUnsignedSriInvoiceXmlPreview({
    documentId,
    profile: {
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      ruc: profile.ruc,
      environment: profile.environment,
      accountingRequired: profile.accountingRequired,
    },
    establishment: {
      code: doc.establishment.code,
      name: doc.establishment.name,
      address: doc.establishment.address,
    },
    issuePoint: {
      code: doc.issuePoint.code,
    },
    sequentialNumber,
    document: {
      documentType: doc.documentType,
      customerName: doc.customerName,
      customerIdentification: doc.customerIdentification,
      customerEmail: doc.customerEmail,
      customerPhone: doc.customerPhone,
      subtotal: doc.subtotal.toString(),
      taxTotal: doc.taxTotal.toString(),
      discountTotal: doc.discountTotal.toString(),
      grandTotal: doc.grandTotal.toString(),
      issuedAt: doc.issuedAt,
      createdAt: doc.createdAt,
    },
    lines: doc.lines.map((l) => ({
      itemName: l.itemName,
      itemCode: l.itemCode,
      quantity: l.quantity.toString(),
      unitPrice: l.unitPrice.toString(),
      discountAmount: l.discountAmount.toString(),
      subtotal: l.subtotal.toString(),
      taxRate: l.taxRate.toString(),
      taxAmount: l.taxAmount.toString(),
    })),
  });

  return NextResponse.json({
    xml: result.xml,
    displayNumber: result.displayNumber,
    warnings: result.warnings,
    missingFields: result.missingFields,
    accessKey: result.accessKey,
    status: doc.status,
  });
}
