import Link from "next/link";
import {
  Building2,
  Globe,
  MapPinned,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  SriCenterBadge,
  SriCenterMetricCard,
} from "@/components/appsolux/sri/config-center-ui";
import {
  SriActionCenter,
  type SriActionCenterProps,
} from "@/components/appsolux/sri/sri-action-center";
import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  SRI_DOCUMENT_TYPE_LABELS,
  formatSequentialNumber,
  getSriModuleStatus,
  getSriProfile,
  getSriSignatureConfig,
  listSriEstablishments,
  listSriIssuePoints,
  listSriSequences,
} from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getSignatureLabel(status: Awaited<ReturnType<typeof getSriModuleStatus>>) {
  if (status.signatureStatus === "EXPIRED") return "Expirada";
  if (status.signatureStatus === "READY_FOR_TESTING") return "Lista para pruebas";
  if (status.signatureHasEncryptedCertificate && status.signatureHasEncryptedPassword) {
    return "Certificado cargado";
  }
  if (status.signatureStatus === "UPLOADED_METADATA_ONLY") return "Metadata registrada";
  return "Pendiente";
}

export default async function SriPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Configuracion SRI"
        description="Configura tu empresa, firma electronica, establecimientos y secuenciales para emitir comprobantes electronicos."
        activeHref={routes.sri}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const [
    status,
    profile,
    sigConfigRaw,
    establishments,
    issuePointsRaw,
    sequences,
    sentCount,
    authorizedCount,
    rejectedCount,
    latestSubmissionErrors,
    latestSigningErrors,
  ] = await Promise.all([
    getSriModuleStatus(tenant.id),
    getSriProfile(tenant.id),
    getSriSignatureConfig(tenant.id),
    listSriEstablishments(tenant.id),
    listSriIssuePoints(tenant.id),
    listSriSequences(tenant.id),
    prisma.sriDocument.count({ where: { tenantId: tenant.id, status: "SENT" } }),
    prisma.sriDocument.count({ where: { tenantId: tenant.id, status: "AUTHORIZED" } }),
    prisma.sriDocument.count({ where: { tenantId: tenant.id, status: "REJECTED" } }),
    prisma.sriSubmissionJob.findMany({
      where: { tenantId: tenant.id, status: { in: ["FAILED", "REJECTED"] } },
      select: { id: true, errorMessage: true, updatedAt: true, documentId: true },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    prisma.sriSigningJob.findMany({
      where: { tenantId: tenant.id, status: "FAILED" },
      select: { id: true, errorMessage: true, updatedAt: true, documentId: true },
      orderBy: { updatedAt: "desc" },
      take: 2,
    }),
  ]);

  const signatureLabel = getSignatureLabel(status);
  const integrationReady =
    status.hasProfile &&
    status.profileStatus === "CONFIGURED" &&
    status.establishmentCount > 0 &&
    status.issuePointCount > 0 &&
    status.sequenceCount > 0;

  const pendingAuthorizationCount = sentCount + status.documentStatusCounts.signed;
  const latestErrors = [
    ...latestSubmissionErrors.map((item) => ({
      id: item.id,
      kind: "Envio",
      errorMessage: item.errorMessage,
      updatedAt: item.updatedAt,
      documentId: item.documentId,
    })),
    ...latestSigningErrors.map((item) => ({
      id: item.id,
      kind: "Firma",
      errorMessage: item.errorMessage,
      updatedAt: item.updatedAt,
      documentId: item.documentId,
    })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 4);

  // Serialize sigConfig — strip Date objects
  const sigConfig: SriActionCenterProps["sigConfig"] = sigConfigRaw
    ? {
        status: sigConfigRaw.status,
        fileName: sigConfigRaw.certificateFileName ?? null,
        uploadedAt: sigConfigRaw.certificateUploadedAt?.toISOString() ?? null,
        expiresAt: sigConfigRaw.expiresAt?.toISOString() ?? null,
        isExpired: Boolean(sigConfigRaw.expiresAt && sigConfigRaw.expiresAt < new Date()),
        issuerName: sigConfigRaw.issuerName ?? null,
        subjectName: sigConfigRaw.subjectName ?? null,
        serialNumber: sigConfigRaw.serialNumber ?? null,
        hasEncryptedCertificate: Boolean(sigConfigRaw.encryptedCertificateStorageKey),
        hasEncryptedPassword: Boolean(sigConfigRaw.encryptedCertificatePassword),
      }
    : null;

  // Serialize issue points
  const issuePoints: SriActionCenterProps["issuePoints"] = issuePointsRaw.map((ip) => ({
    id: ip.id,
    code: ip.code,
    name: ip.name,
    isActive: ip.isActive,
    establishmentId: ip.establishmentId,
    establishmentCode: ip.establishment.code,
  }));

  // Serialize sequences
  const sequencesSerialized: SriActionCenterProps["sequences"] = sequences.map((seq) => ({
    id: seq.id,
    documentType: seq.documentType,
    documentTypeLabel: SRI_DOCUMENT_TYPE_LABELS[seq.documentType] ?? seq.documentType,
    currentNumber: seq.currentNumber,
    isActive: seq.isActive,
    establishmentCode: seq.establishment.code,
    issuePointCode: seq.issuePoint.code,
  }));

  // Serialize initialProfile for company modal
  const initialProfile: SriActionCenterProps["initialProfile"] = profile
    ? {
        legalName: profile.legalName,
        tradeName: profile.tradeName,
        ruc: profile.ruc,
        environment: profile.environment,
        accountingRequired: profile.accountingRequired,
        specialTaxpayerNumber: profile.specialTaxpayerNumber,
        withholdingAgentResolution: profile.withholdingAgentResolution,
      }
    : null;

  return (
    <SriModuleShell
      title="Configuracion SRI"
      description="Configura tu empresa, firma electronica, establecimientos y secuenciales para emitir comprobantes electronicos."
      activeHref={routes.sri}
      action={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={routes.sriDocuments}>Ver facturas</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.sriSignature}>Firma electronica</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-8">

        {/* ── 1. Metric cards ── */}
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-slate-50 px-6 py-7 lg:px-8">
          <div className="mb-5 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Centro de configuracion
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Configura y monitorea tu integracion con el SRI.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Prepara la emision: empresa, firma electronica, establecimientos, secuenciales y ambiente.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SriCenterMetricCard
              icon={Building2}
              label="Perfil tributario"
              value={status.hasProfile ? "Listo" : "Pendiente"}
              helper={status.ruc ? `RUC ${status.ruc}` : "Empresa y RUC aun no configurados."}
              tone={status.hasProfile ? "success" : "warning"}
            />
            <SriCenterMetricCard
              icon={ShieldCheck}
              label="Firma electronica"
              value={signatureLabel}
              helper="Estado real de la firma y sus credenciales cifradas."
              tone={status.signatureHasEncryptedCertificate ? "success" : "warning"}
            />
            <SriCenterMetricCard
              icon={MapPinned}
              label="Estructura activa"
              value={`${status.establishmentCount}/${status.issuePointCount}/${status.sequenceCount}`}
              helper="Establecimientos / puntos de emision / secuenciales activos."
              tone={integrationReady ? "success" : "warning"}
            />
            <SriCenterMetricCard
              icon={Globe}
              label="Ambiente"
              value={
                status.environment === "TEST"
                  ? "Pruebas"
                  : status.environment === "PRODUCTION"
                    ? "Produccion"
                    : "Pendiente"
              }
              helper="Controla si la emision va a pruebas o produccion."
              tone={status.environment ? "info" : "warning"}
            />
          </div>
        </section>

        {/* ── 2. Interactive action center (client) ── */}
        <SriActionCenter
          hasProfile={status.hasProfile}
          profileStatus={status.profileStatus}
          signatureLabel={signatureLabel}
          signatureHasEncryptedCertificate={status.signatureHasEncryptedCertificate}
          signatureHasEncryptedPassword={status.signatureHasEncryptedPassword}
          establishmentCount={status.establishmentCount}
          issuePointCount={status.issuePointCount}
          sequenceCount={status.sequenceCount}
          environment={status.environment}
          integrationReady={integrationReady}
          ruc={status.ruc}
          legalName={profile?.legalName ?? null}
          initialProfile={initialProfile}
          sigConfig={sigConfig}
          profileId={profile?.id ?? null}
          establishments={establishments.map((est) => ({
            id: est.id,
            code: est.code,
            name: est.name,
            address: est.address,
            isMain: est.isMain,
            isActive: est.isActive,
          }))}
          issuePoints={issuePoints}
          sequences={sequencesSerialized}
        />

        {/* ── 3. Monitoring ── */}
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-slate-900">Monitoreo</CardTitle>
                <SriCenterBadge label="Resumen operativo" variant="info" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Preparando</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {status.documentStatusCounts.draft + status.documentStatusCounts.readyForTesting}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Enviando / por autorizar</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingAuthorizationCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Autorizados</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{authorizedCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Rechazados</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{rejectedCount}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.sriDocuments}>Ver facturas y comprobantes</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-slate-900">Ultimos errores</CardTitle>
                <SriCenterBadge
                  label={latestErrors.length > 0 ? "Revisar" : "Sin errores"}
                  variant={latestErrors.length > 0 ? "warning" : "success"}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              {latestErrors.length > 0 ? (
                latestErrors.map((error) => (
                  <div
                    key={error.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                          <TriangleAlert className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{error.kind}</p>
                          <p className="mt-1 text-slate-600">
                            {error.errorMessage ?? "Sin detalle disponible."}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(error.updatedAt).toLocaleString("es-EC")}
                          </p>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/sri/documents/${error.documentId}`}>Abrir</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  No hay errores recientes de firma o envio SRI.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SriModuleShell>
  );
}
