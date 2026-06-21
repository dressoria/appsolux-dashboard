import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { readSignedXml } from "@/lib/core/sri-signed-xml-storage";

type Props = { params: Promise<{ documentId: string }> };

export async function GET(_req: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const prisma = getPrismaClient();

  // Validar que el documento pertenece al tenant
  const document = await prisma.sriDocument.findFirst({
    where: { id: documentId, tenantId: tenant.id },
    select: { id: true, status: true, accessKey: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  // Obtener el último job de firma exitoso
  const signingJob = await prisma.sriSigningJob.findFirst({
    where: {
      documentId,
      tenantId: tenant.id,
      status: "SUCCEEDED",
      signedXmlStorageKey: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { signedXmlStorageKey: true },
  });

  if (!signingJob?.signedXmlStorageKey) {
    return NextResponse.json(
      { error: "El documento aun no tiene XML firmado disponible." },
      { status: 404 }
    );
  }

  let xml: string;
  try {
    xml = await readSignedXml(signingJob.signedXmlStorageKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al leer XML firmado.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const accessKey = document.accessKey ?? documentId;
  const filename = `factura-${accessKey}.xml`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
