import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { readAuthorizedXml } from "@/lib/core/sri-authorized-xml-storage";

type Props = { params: Promise<{ documentId: string }> };

export async function GET(_req: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const prisma = getPrismaClient();

  const document = await prisma.sriDocument.findFirst({
    where: { id: documentId, tenantId: tenant.id },
    select: { id: true, status: true, accessKey: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  if (document.status !== "AUTHORIZED") {
    return NextResponse.json(
      { error: "El documento no está autorizado todavía." },
      { status: 422 }
    );
  }

  // Buscar el job de submission autorizado con XML guardado
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
      sriAuthorizationNumber: true,
    },
  });

  if (!submissionJob?.authorizedXmlStorageKey) {
    return NextResponse.json(
      { error: "El XML de autorización aún no está disponible para descarga." },
      { status: 404 }
    );
  }

  let xml: string;
  try {
    xml = await readAuthorizedXml(submissionJob.authorizedXmlStorageKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al leer XML autorizado.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const accessKey = document.accessKey ?? documentId;
  const filename = `factura-${accessKey}-autorizada.xml`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
