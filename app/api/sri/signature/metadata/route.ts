import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { updateSriSignatureMetadata } from "@/lib/core/sri";
import { validateCertificateMetadata } from "@/lib/core/sri-signature";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);

  const body = (await req.json()) as {
    certificateFileName?: string;
    expiresAt?: string;
    issuerName?: string;
    subjectName?: string;
    serialNumber?: string;
    fingerprintSha256?: string;
  };

  const { certificateFileName, expiresAt, issuerName, subjectName, serialNumber, fingerprintSha256 } = body;

  if (!certificateFileName?.trim() || !expiresAt) {
    return NextResponse.json(
      { error: "Nombre de archivo y fecha de vencimiento son requeridos." },
      { status: 400 }
    );
  }

  const parsedExpiry = new Date(expiresAt);
  if (isNaN(parsedExpiry.getTime())) {
    return NextResponse.json({ error: "Fecha de vencimiento inválida." }, { status: 400 });
  }

  const validation = validateCertificateMetadata({
    certificateFileName: certificateFileName.trim(),
    expiresAt: parsedExpiry,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors.join(" "), errors: validation.errors },
      { status: 422 }
    );
  }

  try {
    const config = await updateSriSignatureMetadata(tenant.id, {
      certificateFileName: certificateFileName.trim(),
      expiresAt: parsedExpiry,
      issuerName: issuerName?.trim() || null,
      subjectName: subjectName?.trim() || null,
      serialNumber: serialNumber?.trim() || null,
      fingerprintSha256: fingerprintSha256?.trim() || null,
    });

    return NextResponse.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al guardar metadata.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
