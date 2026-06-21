import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { getSriProfile, formatSequentialNumber } from "@/lib/core/sri";
import { generateRidePdf, type RideData } from "@/lib/core/sri-ride-generator";
import { saveRidePdf, readRidePdf, buildRideStorageKey } from "@/lib/core/sri-ride-storage";

type Props = { params: Promise<{ documentId: string }> };

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  "01": "Sin utilización del sistema financiero (efectivo)",
  "15": "Compensación de deudas",
  "16": "Tarjeta de débito",
  "17": "Dinero electrónico",
  "18": "Tarjeta prepago",
  "19": "Tarjeta de crédito",
  "20": "Otros con utilización del sistema financiero",
  "21": "Endoso de títulos",
};

export async function GET(_req: Request, { params }: Props) {
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
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  if (doc.status !== "AUTHORIZED") {
    return NextResponse.json(
      { error: "El RIDE solo está disponible para documentos autorizados." },
      { status: 422 }
    );
  }

  // Si ya hay RIDE guardado, servirlo directamente
  if (doc.ridePdfStorageKey) {
    try {
      const pdfBuffer = await readRidePdf(doc.ridePdfStorageKey);
      return pdfResponse(pdfBuffer, buildFilename(doc));
    } catch {
      // Continuar a regenerar si no se puede leer
    }
  }

  // Obtener datos adicionales para generar el RIDE
  const [profile, submissionJob] = await Promise.all([
    getSriProfile(tenant.id),
    prisma.sriSubmissionJob.findFirst({
      where: {
        documentId,
        tenantId: tenant.id,
        status: "AUTHORIZED",
      },
      orderBy: { createdAt: "desc" },
      select: {
        sriAuthorizationNumber: true,
        authorizedAt: true,
      },
    }),
  ]);

  if (!profile) {
    return NextResponse.json(
      { error: "Perfil tributario del tenant no encontrado." },
      { status: 500 }
    );
  }

  if (!submissionJob?.sriAuthorizationNumber || !submissionJob.authorizedAt) {
    return NextResponse.json(
      { error: "Datos de autorización SRI no disponibles." },
      { status: 404 }
    );
  }

  if (doc.sequentialNumber == null || !doc.accessKey) {
    return NextResponse.json(
      { error: "El documento no tiene numeración completa." },
      { status: 422 }
    );
  }

  const rideData: RideData = {
    environment: doc.environment as "TEST" | "PRODUCTION",
    documentType: doc.documentType,
    establishmentCode: doc.establishment.code,
    issuePointCode: doc.issuePoint.code,
    sequentialNumber: doc.sequentialNumber,
    accessKey: doc.accessKey,
    authorizationNumber: submissionJob.sriAuthorizationNumber,
    authorizedAt: submissionJob.authorizedAt,
    issuedAt: doc.issuedAt ?? doc.createdAt,
    emitter: {
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      ruc: profile.ruc,
      dirMatriz: profile.dirMatriz ?? null,
      contribuyenteRimpe: profile.contribuyenteRimpe ?? null,
      accountingRequired: profile.accountingRequired ?? false,
    },
    customer: {
      name: doc.customerName,
      identification: doc.customerIdentification,
      email: doc.customerEmail,
    },
    lines: doc.lines.map((l) => ({
      itemCode: l.itemCode,
      itemName: l.itemName,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discountAmount: Number(l.discountAmount),
      subtotal: Number(l.subtotal),
      taxRate: Number(l.taxRate),
      taxAmount: Number(l.taxAmount),
      total: Number(l.total),
    })),
    subtotal: Number(doc.subtotal),
    taxTotal: Number(doc.taxTotal),
    discountTotal: Number(doc.discountTotal),
    grandTotal: Number(doc.grandTotal),
    paymentMethod: PAYMENT_METHOD_LABELS["01"]!,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateRidePdf(rideData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error generando PDF.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Guardar en storage y actualizar el documento (best-effort)
  try {
    const storageKey = await saveRidePdf(tenant.id, documentId, pdfBuffer);
    await prisma.sriDocument.update({
      where: { id: documentId },
      data: { ridePdfStorageKey: storageKey },
    });
  } catch {
    // El PDF se sirve igualmente aunque falle el guardado
  }

  return pdfResponse(pdfBuffer, buildFilename(doc));
}

function buildFilename(doc: {
  establishment: { code: string };
  issuePoint: { code: string };
  sequentialNumber: number | null;
  accessKey: string | null;
}): string {
  if (doc.sequentialNumber != null) {
    const num = `${doc.establishment.code}-${doc.issuePoint.code}-${formatSequentialNumber(doc.sequentialNumber)}`;
    return `factura-${num}-ride.pdf`;
  }
  return `factura-${doc.accessKey ?? "ride"}.pdf`;
}

function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
