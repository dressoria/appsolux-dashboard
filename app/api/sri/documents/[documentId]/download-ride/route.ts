import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { formatSequentialNumber } from "@/lib/core/sri";
import { generateRidePdfFromAuthorizedXml } from "@/lib/core/sri-ride-generator";
import { saveRidePdf } from "@/lib/core/sri-ride-storage";
import { readAuthorizedXml } from "@/lib/core/sri-authorized-xml-storage";
import { parseAuthorizedSriInvoiceXml } from "@/lib/core/sri-authorized-xml-parser";

type Props = { params: Promise<{ documentId: string }> };

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

  const submissionJob = await prisma.sriSubmissionJob.findFirst({
    where: {
      documentId,
      tenantId: tenant.id,
      status: "AUTHORIZED",
      authorizedXmlStorageKey: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      authorizedXmlStorageKey: true,
    },
  });

  if (!submissionJob?.authorizedXmlStorageKey) {
    return NextResponse.json(
      { error: "XML autorizado aún no disponible para generar el RIDE." },
      { status: 404 }
    );
  }

  let authorizedXml: string;
  try {
    authorizedXml = await readAuthorizedXml(submissionJob.authorizedXmlStorageKey);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al leer XML autorizado.";
    const status = message.includes("XML autorizado aún no disponible") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  let pdfBuffer: Buffer;
  try {
    const parsedInvoice = parseAuthorizedSriInvoiceXml(authorizedXml);
    pdfBuffer = await generateRidePdfFromAuthorizedXml(parsedInvoice);
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
    return `ride-${num}.pdf`;
  }
  return `ride-${doc.accessKey ?? "pdf"}.pdf`;
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
