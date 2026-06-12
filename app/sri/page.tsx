import Link from "next/link";
import {
  Building2,
  FileCheck2,
  Globe,
  KeyRound,
  MapPinned,
  ShieldCheck,
  Store,
  TriangleAlert,
} from "lucide-react";

import {
  SriCenterActionCard,
  SriCenterBadge,
  SriCenterChecklistItem,
  SriCenterMetricCard,
} from "@/components/appsolux/sri/config-center-ui";
import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { getSriModuleStatus } from "@/lib/core/sri";
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

function getRecommendedStep(status: Awaited<ReturnType<typeof getSriModuleStatus>>) {
  if (!status.hasProfile) {
    return {
      text: "Configura primero la empresa y el RUC.",
      href: routes.sriCompany,
      actionLabel: "Configurar empresa",
    };
  }

  if (status.establishmentCount === 0) {
    return {
      text: "Agrega al menos un establecimiento activo.",
      href: routes.sriEstablishments,
      actionLabel: "Agregar establecimiento",
    };
  }

  if (status.issuePointCount === 0) {
    return {
      text: "Configura un punto de emision para continuar.",
      href: routes.sriIssuePoints,
      actionLabel: "Agregar punto de emision",
    };
  }

  if (status.sequenceCount === 0) {
    return {
      text: "Activa una secuencia de factura para emitir comprobantes.",
      href: routes.sriSequences,
      actionLabel: "Configurar secuenciales",
    };
  }

  if (!status.signatureHasEncryptedCertificate || !status.signatureHasEncryptedPassword) {
    return {
      text: "Sube la firma electronica de la empresa.",
      href: routes.sriSignature,
      actionLabel: "Subir firma electronica",
    };
  }

  return {
    text: "La configuracion base esta lista. Revisa facturas y monitoreo para seguir el flujo.",
    href: routes.sriDocuments,
    actionLabel: "Ver facturas",
  };
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
  const status = await getSriModuleStatus(tenant.id);
  const recommendedStep = getRecommendedStep(status);
  const signatureLabel = getSignatureLabel(status);

  const [sentCount, authorizedCount, rejectedCount, latestSubmissionErrors, latestSigningErrors] =
    await Promise.all([
      prisma.sriDocument.count({ where: { tenantId: tenant.id, status: "SENT" } }),
      prisma.sriDocument.count({ where: { tenantId: tenant.id, status: "AUTHORIZED" } }),
      prisma.sriDocument.count({ where: { tenantId: tenant.id, status: "REJECTED" } }),
      prisma.sriSubmissionJob.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ["FAILED", "REJECTED"] },
        },
        select: {
          id: true,
          errorMessage: true,
          updatedAt: true,
          documentId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      prisma.sriSigningJob.findMany({
        where: {
          tenantId: tenant.id,
          status: "FAILED",
        },
        select: {
          id: true,
          errorMessage: true,
          updatedAt: true,
          documentId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 2,
      }),
    ]);

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

  const integrationReady =
    status.hasProfile &&
    status.profileStatus === "CONFIGURED" &&
    status.establishmentCount > 0 &&
    status.issuePointCount > 0 &&
    status.sequenceCount > 0;

  return (
    <SriModuleShell
      title="Configuracion SRI"
      description="Configura tu empresa, firma electronica, establecimientos y secuenciales para emitir comprobantes electronicos."
      activeHref={routes.sri}
      appName="Configuracion SRI"
      appDescription="Centro de configuracion, firma, secuenciales, ambiente y monitoreo tributario."
      badge="Configuracion"
      badgeVariant="blue"
      action={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={routes.sriDocuments}>Ver facturas</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.sriSignature}>Subir firma electronica</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.sriEnvironment}>Revisar ambiente</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.95fr] lg:px-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Centro de configuracion
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Configura y monitorea tu integracion con el SRI.
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Este espacio sirve para preparar la emision: empresa, firma electronica,
                  establecimientos, secuenciales, ambiente y monitoreo. Para emitir y revisar
                  facturas, usa Facturacion.
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
                  helper="Establecimientos, puntos de emision y secuenciales activos."
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
            </div>

            <Card className="rounded-[28px] border-slate-200 bg-white/95 py-0 shadow-sm">
              <CardHeader className="px-6 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-slate-900">Estado de integracion</CardTitle>
                  <SriCenterBadge
                    label={integrationReady ? "Base lista" : "Pendiente"}
                    variant={integrationReady ? "success" : "warning"}
                  />
                </div>
                <p className="text-sm text-slate-600">
                  Checklist visual para saber que falta antes de emitir comprobantes.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-6 pb-6">
                <SriCenterChecklistItem
                  label="Perfil tributario"
                  value={status.profileStatus === "CONFIGURED" ? "Configurado" : "Pendiente"}
                  ok={status.profileStatus === "CONFIGURED"}
                  href={routes.sriCompany}
                  actionLabel={status.profileStatus === "CONFIGURED" ? "Editar" : "Configurar"}
                />
                <SriCenterChecklistItem
                  label="Firma electronica"
                  value={signatureLabel}
                  ok={status.signatureHasEncryptedCertificate && status.signatureHasEncryptedPassword}
                  href={routes.sriSignature}
                  actionLabel="Revisar"
                />
                <SriCenterChecklistItem
                  label="Establecimiento activo"
                  value={status.establishmentCount > 0 ? `${status.establishmentCount} activo(s)` : "Pendiente"}
                  ok={status.establishmentCount > 0}
                  href={routes.sriEstablishments}
                  actionLabel="Ver"
                />
                <SriCenterChecklistItem
                  label="Punto de emision activo"
                  value={status.issuePointCount > 0 ? `${status.issuePointCount} activo(s)` : "Pendiente"}
                  ok={status.issuePointCount > 0}
                  href={routes.sriIssuePoints}
                  actionLabel="Ver"
                />
                <SriCenterChecklistItem
                  label="Secuencia activa"
                  value={status.sequenceCount > 0 ? `${status.sequenceCount} configurada(s)` : "Pendiente"}
                  ok={status.sequenceCount > 0}
                  href={routes.sriSequences}
                  actionLabel="Ver"
                />
                <SriCenterChecklistItem
                  label="Ambiente"
                  value={
                    status.environment === "TEST"
                      ? "Pruebas activas"
                      : status.environment === "PRODUCTION"
                        ? "Produccion activa"
                        : "Pendiente"
                  }
                  ok={status.environment !== null}
                  href={routes.sriEnvironment}
                  actionLabel="Revisar"
                />
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <SriCenterActionCard
            href={routes.sriCompany}
            title="Empresa y RUC"
            description="Actualiza razon social, RUC y datos tributarios base."
            icon={Building2}
            status={status.hasProfile ? "Configurado" : "Pendiente"}
            statusVariant={status.hasProfile ? "success" : "warning"}
          />
          <SriCenterActionCard
            href={routes.sriEstablishments}
            title="Establecimientos"
            description="Gestiona sucursales autorizadas para emitir comprobantes."
            icon={Store}
            status={status.establishmentCount > 0 ? `${status.establishmentCount} activo(s)` : "Pendiente"}
            statusVariant={status.establishmentCount > 0 ? "success" : "warning"}
          />
          <SriCenterActionCard
            href={routes.sriIssuePoints}
            title="Puntos de emision"
            description="Define los puntos de emision disponibles por establecimiento."
            icon={MapPinned}
            status={status.issuePointCount > 0 ? `${status.issuePointCount} activo(s)` : "Pendiente"}
            statusVariant={status.issuePointCount > 0 ? "success" : "warning"}
          />
          <SriCenterActionCard
            href={routes.sriSequences}
            title="Secuenciales"
            description="Activa y revisa las secuencias para facturas electronicas."
            icon={KeyRound}
            status={status.sequenceCount > 0 ? `${status.sequenceCount} lista(s)` : "Pendiente"}
            statusVariant={status.sequenceCount > 0 ? "success" : "warning"}
          />
          <SriCenterActionCard
            href={routes.sriSignature}
            title="Firma electronica"
            description="Carga el certificado y valida si ya esta listo para pruebas."
            icon={ShieldCheck}
            status={signatureLabel}
            statusVariant={
              status.signatureHasEncryptedCertificate && status.signatureHasEncryptedPassword
                ? "success"
                : "warning"
            }
          />
          <SriCenterActionCard
            href={routes.sriEnvironment}
            title="Ambiente"
            description="Confirma si la integracion apunta a pruebas o produccion."
            icon={Globe}
            status={
              status.environment === "TEST"
                ? "Pruebas"
                : status.environment === "PRODUCTION"
                  ? "Produccion"
                  : "Pendiente"
            }
            statusVariant={status.environment ? "info" : "warning"}
          />
          <SriCenterActionCard
            href={routes.sriDocuments}
            title="Comprobantes / monitoreo"
            description="Ver facturas y comprobantes con sus estados operativos."
            icon={FileCheck2}
            status={status.documentCount > 0 ? `${status.documentCount} documento(s)` : "Sin actividad"}
            statusVariant={status.documentCount > 0 ? "info" : "neutral"}
          />
        </div>

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
              <Button asChild variant="outline">
                <Link href={routes.sriDocuments}>Ver facturas y comprobantes</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-slate-900">Ultimos errores</CardTitle>
                <SriCenterBadge label={latestErrors.length > 0 ? "Revisar" : "Sin errores"} variant={latestErrors.length > 0 ? "warning" : "success"} />
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
                  No hay errores recientes de firma o envio SRI para mostrar.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-slate-900">Siguiente paso recomendado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <p className="text-sm text-slate-600">{recommendedStep.text}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={recommendedStep.href}>{recommendedStep.actionLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.sriDocuments}>Ir a Facturacion</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SriModuleShell>
  );
}
