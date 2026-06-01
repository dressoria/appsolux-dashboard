import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriSignatureConfig } from "@/lib/core/sri";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const config = await getSriSignatureConfig(tenant.id);

  return NextResponse.json({
    config: config
      ? {
          id: config.id,
          tenantId: config.tenantId,
          profileId: config.profileId,
          status: config.status,
          certificateFileName: config.certificateFileName,
          certificateUploadedAt: config.certificateUploadedAt,
          expiresAt: config.expiresAt,
          issuerName: config.issuerName,
          subjectName: config.subjectName,
          serialNumber: config.serialNumber,
          fingerprintSha256: config.fingerprintSha256,
          hasEncryptedCertificate: Boolean(config.encryptedCertificateStorageKey),
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        }
      : null,
  });
}
