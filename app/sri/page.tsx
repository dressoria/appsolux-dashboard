import Link from "next/link";
import { FileText } from "lucide-react";

import { SriActionCenter, type SriActionCenterProps } from "@/components/appsolux/sri/sri-action-center";
import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getSriModuleStatus, getSriProfile, getSriSignatureConfig, listSriEstablishments, listSriIssuePoints, listSriSequences } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriSignatureReadiness } from "@/lib/core/sri-signature-readiness";

export default async function SriPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <SriModuleShell title="Facturación electrónica" description="Configura Facturom en tres pasos." activeHref={routes.sri}><p className="text-muted-foreground">Sesión requerida.</p></SriModuleShell>;
  }

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();
  const [status, profile, sigConfigRaw, establishments, issuePoints, sequences, tenantProfile] = await Promise.all([
    getSriModuleStatus(tenant.id),
    getSriProfile(tenant.id),
    getSriSignatureConfig(tenant.id),
    listSriEstablishments(tenant.id),
    listSriIssuePoints(tenant.id),
    listSriSequences(tenant.id),
    prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { name: true, legalName: true, taxIdentificationType: true, taxIdentificationValue: true, address: true },
    }),
  ]);

  const establishment = establishments.find((item) => item.isMain && item.isActive) ?? establishments.find((item) => item.isActive) ?? null;
  const issuePoint = establishment
    ? issuePoints.find((item) => item.establishmentId === establishment.id && item.isActive) ?? null
    : null;
  const invoiceSequence = establishment && issuePoint
    ? sequences.find((item) => item.establishmentId === establishment.id && item.issuePointId === issuePoint.id && item.documentType === "INVOICE" && item.isActive) ?? null
    : null;
  const localHistory = establishment && issuePoint
    ? await prisma.sriDocument.aggregate({
        where: { tenantId: tenant.id, establishmentId: establishment.id, issuePointId: issuePoint.id, documentType: "INVOICE", sequentialNumber: { not: null } },
        _max: { sequentialNumber: true },
      })
    : { _max: { sequentialNumber: null } };
  const localNextNumber = (localHistory._max.sequentialNumber ?? 0) + 1;
  const nextNumber = Math.max(invoiceSequence?.currentNumber ?? 1, localNextNumber);
  const now = new Date();
  const signatureReadiness = getSriSignatureReadiness(sigConfigRaw, now);
  const signatureExpired = signatureReadiness.isExpired;
  const signatureReady = signatureReadiness.isReady;
  const profileReady = Boolean(profile && profile.status === "CONFIGURED" && profile.ruc && profile.dirMatriz);
  const emissionReady = Boolean(establishment && issuePoint && invoiceSequence);

  const sigConfig: SriActionCenterProps["sigConfig"] = sigConfigRaw ? {
    status: sigConfigRaw.status,
    fileName: sigConfigRaw.certificateFileName ?? null,
    uploadedAt: sigConfigRaw.certificateUploadedAt?.toISOString() ?? null,
    expiresAt: sigConfigRaw.expiresAt?.toISOString() ?? null,
    isExpired: signatureExpired,
    issuerName: sigConfigRaw.issuerName ?? null,
    subjectName: sigConfigRaw.subjectName ?? null,
    serialNumber: sigConfigRaw.serialNumber ?? null,
    hasEncryptedCertificate: Boolean(sigConfigRaw.encryptedCertificateStorageKey),
    hasEncryptedPassword: Boolean(sigConfigRaw.encryptedCertificatePassword),
  } : null;

  const initialProfile: SriActionCenterProps["initialProfile"] = profile ? {
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    ruc: profile.ruc,
    dirMatriz: profile.dirMatriz,
    accountingRequired: profile.accountingRequired,
    specialTaxpayerNumber: profile.specialTaxpayerNumber,
    withholdingAgentResolution: profile.withholdingAgentResolution,
  } : null;
  const tenantTaxType = tenantProfile?.taxIdentificationType === "cedula" ? "cedula" : "ruc";
  const companyPrefill: SriActionCenterProps["companyPrefill"] = {
    identificationType: tenantTaxType,
    legalName: tenantProfile?.legalName ?? "",
    tradeName: tenantProfile?.name ?? "",
    ruc: tenantTaxType === "ruc" ? tenantProfile?.taxIdentificationValue ?? "" : "",
    address: tenantProfile?.address ?? "",
  };

  return (
    <SriModuleShell
      title="Facturación electrónica"
      description="Configura Facturom en tres pasos. No necesitas conocer términos técnicos para comenzar."
      activeHref={routes.sri}
      appName="Facturación electrónica"
      action={<Button asChild variant="outline" size="sm" className="rounded-xl"><Link href={routes.sriDocuments}><FileText className="mr-2 h-4 w-4" />Ver comprobantes</Link></Button>}
    >
      <SriActionCenter
        profileReady={profileReady}
        signatureReady={signatureReady}
        signatureExpired={signatureExpired}
        signatureExpiresSoon={signatureReadiness.expiresSoon}
        emissionReady={emissionReady}
        ruc={status.ruc}
        legalName={profile?.legalName ?? null}
        initialProfile={initialProfile}
        companyPrefill={companyPrefill}
        sigConfig={sigConfig}
        emissionDefaults={{
          establishmentCode: establishment?.code ?? "001",
          establishmentName: establishment?.name ?? "Matriz",
          address: establishment?.address ?? profile?.dirMatriz ?? tenantProfile?.address ?? "",
          issuePointCode: issuePoint?.code ?? "001",
          nextNumber,
          hasLocalHistory: (localHistory._max.sequentialNumber ?? 0) > 0,
        }}
      />
    </SriModuleShell>
  );
}
