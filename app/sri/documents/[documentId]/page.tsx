import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileCheck2, FileText } from "lucide-react";

import { SriDownloadButton } from "@/components/appsolux/sri/sri-download-button";

import {
  FacturationStatusBadge,
} from "@/components/appsolux/sri/facturation-ui";
import { SriDocumentCollapsible } from "@/components/appsolux/sri/sri-document-collapsible";
import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { SriSigningJobSection } from "@/components/appsolux/sri/sri-signing-job-section";
import { SriSubmissionJobSection } from "@/components/appsolux/sri/sri-submission-job-section";
import { SriTechnicalChecklistSection } from "@/components/appsolux/sri/sri-technical-checklist-section";
import { SriXmlPreviewSection } from "@/components/appsolux/sri/sri-xml-preview-section";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSaleById } from "@/lib/core/lightweight-pos";
import {
  getSriDocumentById,
  getSriProfile,
  SRI_DOCUMENT_TYPE_LABELS,
  formatSequentialNumber,
} from "@/lib/core/sri";
import { getLatestSriSigningJobForDocument } from "@/lib/core/sri-signing-jobs";
import { getLatestSriSubmissionJobForDocument } from "@/lib/core/sri-submission-jobs";
import { getSriDocumentReadinessForSigning } from "@/lib/core/sri-technical-checklist";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type Props = { params: Promise<{ documentId: string }> };

export const dynamic = "force-dynamic";

function money(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function buildDisplayNumber(
  establishmentCode: string,
  issuePointCode: string,
  sequentialNumber: number | null
) {
  if (sequentialNumber == null) {
    return `${establishmentCode}-${issuePointCode} · pendiente`;
  }
  return `${establishmentCode}-${issuePointCode}-${formatSequentialNumber(sequentialNumber)}`;
}

// ── Stepper ───────────────────────────────────────────────────────────────────

const STEPPER_STEPS = [
  "Preparado",
  "Firmado",
  "Enviado al SRI",
  "Autorizado",
] as const;

function getStepIndex(docStatus: string, latestJobStatus: string | null): number {
  if (docStatus === "AUTHORIZED") return 3;
  if (docStatus === "SENT") return 2;
  if (docStatus === "SIGNED" || latestJobStatus === "SUCCEEDED") return 1;
  return 0;
}

function SriDocumentStepper({
  step,
  isRejected,
}: {
  step: number;
  isRejected: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Progreso del comprobante
      </p>
      <div className="flex items-start">
        {STEPPER_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step && !isRejected;
          const isError = isRejected && i === step;
          return (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={`h-0.5 flex-1 ${
                    i === 0
                      ? "invisible"
                      : done || active
                        ? "bg-[#007BFF]"
                        : "bg-slate-200"
                  }`}
                />
                <div
                  className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                    isError
                      ? "border-red-500 bg-red-100"
                      : active
                        ? "border-[#007BFF] bg-[#007BFF]"
                        : done
                          ? "border-[#007BFF] bg-[#007BFF]"
                          : "border-slate-300 bg-white"
                  }`}
                />
                <div
                  className={`h-0.5 flex-1 ${
                    i === STEPPER_STEPS.length - 1
                      ? "invisible"
                      : done
                        ? "bg-[#007BFF]"
                        : "bg-slate-200"
                  }`}
                />
              </div>
              <p
                className={`mt-2 max-w-[60px] text-center text-[9px] font-medium leading-tight sm:text-[10px] ${
                  isError
                    ? "text-red-600"
                    : active
                      ? "text-[#007BFF]"
                      : done
                        ? "text-[#007BFF]"
                        : "text-slate-400"
                }`}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
      {isRejected && (
        <p className="mt-3 text-center text-xs font-medium text-red-600">
          Rechazado por el SRI
        </p>
      )}
    </div>
  );
}

// ── Siguiente acción ──────────────────────────────────────────────────────────

type NextActionVariant = "success" | "info" | "warning" | "error" | "neutral";

type NextAction = {
  variant: NextActionVariant;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

function computeNextAction(params: {
  docStatus: string;
  latestJobStatus: string | null;
  latestJobError: string | null;
  submissionError: string | null;
  canRequestSigning: boolean;
  missingSignatureReasons: string[];
  checklistHasBlockers: boolean;
  checklistHasWarnings: boolean;
}): NextAction {
  const {
    docStatus,
    latestJobStatus,
    latestJobError,
    submissionError,
    canRequestSigning,
    missingSignatureReasons,
    checklistHasBlockers,
    checklistHasWarnings,
  } = params;

  if (docStatus === "AUTHORIZED") {
    return {
      variant: "success",
      title: "Autorizado por el SRI",
      description:
        "El comprobante esta autorizado. Descarga el RIDE/PDF o los XML desde el panel de autorizacion.",
    };
  }

  if (docStatus === "REJECTED") {
    return {
      variant: "error",
      title: "Rechazado por el SRI",
      description:
        submissionError ??
        "Este comprobante fue rechazado y no puede reenviarse con la misma clave. Emite un nuevo comprobante.",
    };
  }

  if (docStatus === "SENT") {
    return {
      variant: "info",
      title: "Recibido por el SRI",
      description:
        "El SRI recibio el comprobante y esta procesando la autorizacion. El resultado llegara automaticamente.",
    };
  }

  if (docStatus === "SIGNED") {
    return {
      variant: "success",
      title: "Comprobante firmado",
      description:
        "El XML esta firmado correctamente. El sistema enviara el comprobante al SRI automaticamente.",
    };
  }

  if (latestJobStatus === "FAILED") {
    return {
      variant: "error",
      title: "Error en la firma",
      description:
        latestJobError ??
        "Hubo un error al procesar la firma. Revisa la seccion de firma electronica para ver el detalle.",
    };
  }

  if (latestJobStatus === "QUEUED" || latestJobStatus === "RUNNING") {
    return {
      variant: "info",
      title: "Firma en proceso",
      description:
        "El sistema esta procesando la firma del comprobante. Actualiza la pagina en unos segundos.",
    };
  }

  if (docStatus === "READY_FOR_TESTING") {
    if (canRequestSigning) {
      if (checklistHasWarnings) {
        return {
          variant: "warning",
          title: "Listo para firmar con advertencias",
          description:
            "Puedes solicitar la firma. Revisa las advertencias si necesitas corregir datos del cliente.",
        };
      }
      return {
        variant: "success",
        title: "Listo para firmar",
        description:
          "El comprobante esta completo. El sistema procesara este comprobante automaticamente.",
      };
    }

    if (checklistHasBlockers) {
      return {
        variant: "error",
        title: "Faltan datos obligatorios",
        description:
          "Hay errores en la verificacion tecnica. Revisa la seccion de verificacion para resolver los errores antes de firmar.",
      };
    }

    const certMissing = missingSignatureReasons.some((r) => r.includes("certificado"));
    const passwordMissing = missingSignatureReasons.some((r) => r.includes("contrase"));
    const expiredCert = missingSignatureReasons.some((r) => r.includes("vencido"));

    if (certMissing) {
      return {
        variant: "warning",
        title: "Falta cargar la firma electronica",
        description:
          "El certificado .p12 no esta configurado. Carga la firma antes de solicitar la firma del comprobante.",
        actionHref: "/sri/signature",
        actionLabel: "Configurar firma",
      };
    }
    if (passwordMissing) {
      return {
        variant: "warning",
        title: "Falta la contrasena del certificado",
        description:
          "El certificado esta cargado pero falta la contrasena cifrada. Completa la configuracion.",
        actionHref: "/sri/signature",
        actionLabel: "Completar configuracion",
      };
    }
    if (expiredCert) {
      return {
        variant: "error",
        title: "Certificado de firma vencido",
        description:
          "El certificado de firma electronica esta vencido. Carga un certificado valido para continuar.",
        actionHref: "/sri/signature",
        actionLabel: "Actualizar certificado",
      };
    }
    return {
      variant: "warning",
      title: "Firma electronica no lista",
      description:
        "Completa la configuracion de firma electronica en SRI → Firma antes de firmar.",
      actionHref: "/sri/signature",
      actionLabel: "Configurar firma",
    };
  }

  // DRAFT
  return {
    variant: "neutral",
    title: "Comprobante en borrador",
    description:
      "Verifica los datos, revisa la verificacion tecnica y prepara el comprobante para firma.",
  };
}

const NEXT_ACTION_STYLES: Record<
  NextActionVariant,
  { card: string; title: string; description: string }
> = {
  success: {
    card: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-800",
    description: "text-emerald-700",
  },
  info: {
    card: "border-blue-200 bg-blue-50",
    title: "text-blue-800",
    description: "text-blue-700",
  },
  warning: {
    card: "border-amber-200 bg-amber-50",
    title: "text-amber-800",
    description: "text-amber-700",
  },
  error: {
    card: "border-red-200 bg-red-50",
    title: "text-red-800",
    description: "text-red-700",
  },
  neutral: {
    card: "border-slate-200 bg-slate-50",
    title: "text-slate-800",
    description: "text-slate-600",
  },
};

function NextActionCard({ action }: { action: NextAction }) {
  const s = NEXT_ACTION_STYLES[action.variant];
  return (
    <div className={`rounded-[24px] border p-5 ${s.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={`text-sm font-semibold ${s.title}`}>{action.title}</p>
          <p className={`text-sm leading-6 ${s.description}`}>{action.description}</p>
        </div>
        {action.actionHref && action.actionLabel && (
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href={action.actionHref}>{action.actionLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SriDocumentDetailPage({ params }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Comprobante"
        description=""
        activeHref={routes.sriDocuments}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const doc = await getSriDocumentById(tenant.id, documentId).catch(() => null);

  if (!doc) {
    notFound();
  }

  const [profile, latestJob, latestSubmissionJob, signingReadiness, sourceSale] =
    await Promise.all([
      getSriProfile(tenant.id).catch(() => null),
      getLatestSriSigningJobForDocument(tenant.id, documentId).catch(() => null),
      getLatestSriSubmissionJobForDocument(tenant.id, documentId).catch(() => null),
      getSriDocumentReadinessForSigning(tenant.id, documentId).catch(() => null),
      doc.sourceType === "BASIC_SALE" && doc.sourceId
        ? getSaleById(tenant.id, doc.sourceId).catch(() => null)
        : Promise.resolve(null),
    ]);

  const typeLabel = SRI_DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType;
  const displayNumber = buildDisplayNumber(
    doc.establishment?.code ?? "???",
    doc.issuePoint?.code ?? "???",
    doc.sequentialNumber
  );
  const isRejected = doc.status === "REJECTED";

  const stepIndex = getStepIndex(doc.status, latestJob?.status ?? null);

  const nextAction = computeNextAction({
    docStatus: doc.status,
    latestJobStatus: latestJob?.status ?? null,
    latestJobError: latestJob?.errorMessage ?? null,
    submissionError: latestSubmissionJob?.errorMessage ?? null,
    canRequestSigning: signingReadiness?.canRequestSigning ?? false,
    missingSignatureReasons: signingReadiness?.missingSignatureReasons ?? [],
    checklistHasBlockers: (signingReadiness?.blockingErrors?.length ?? 0) > 0,
    checklistHasWarnings: (signingReadiness?.warnings?.length ?? 0) > 0,
  });

  const flowStatus =
    doc.status === "AUTHORIZED"
      ? { label: "Autorizado", variant: "success" as const }
      : doc.status === "REJECTED"
        ? { label: "Rechazado", variant: "danger" as const }
        : doc.status === "SENT"
          ? { label: "Recibido por SRI", variant: "info" as const }
          : doc.status === "SIGNED"
            ? { label: "Firmado", variant: "success" as const }
            : doc.status === "READY_FOR_TESTING"
              ? { label: "Listo para firma", variant: "warning" as const }
              : { label: "Borrador", variant: "neutral" as const };

  // Checklist badge derived from signingReadiness
  const checklistStatus = signingReadiness?.latestChecklist?.status;
  const checklistBadge = checklistStatus === "READY"
    ? { text: "Listo", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    : checklistStatus === "WARNING"
      ? { text: "Advertencias", cls: "border-amber-200 bg-amber-50 text-amber-700" }
      : checklistStatus === "BLOCKED"
        ? { text: "Bloqueado", cls: "border-red-200 bg-red-50 text-red-700" }
        : { text: "Verificar", cls: "border-slate-200 bg-slate-50 text-slate-600" };

  // Signing badge
  const signingBadge =
    doc.status === "SIGNED" || latestJob?.status === "SUCCEEDED"
      ? { text: "Firmado", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : latestJob?.status === "FAILED"
        ? { text: "Error", cls: "border-red-200 bg-red-50 text-red-700" }
        : latestJob?.status === "QUEUED" || latestJob?.status === "RUNNING"
          ? { text: "En proceso", cls: "border-blue-200 bg-blue-50 text-blue-700" }
          : { text: "Pendiente", cls: "border-slate-200 bg-slate-50 text-slate-600" };

  // Submission badge
  const submissionBadge =
    doc.status === "AUTHORIZED"
      ? { text: "Autorizado", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : doc.status === "REJECTED"
        ? { text: "Rechazado", cls: "border-red-200 bg-red-50 text-red-700" }
        : doc.status === "SENT"
          ? { text: "Recibido", cls: "border-cyan-200 bg-cyan-50 text-cyan-700" }
          : { text: "Pendiente", cls: "border-slate-200 bg-slate-50 text-slate-600" };

  const showChecklist = doc.status === "DRAFT" || doc.status === "READY_FOR_TESTING";
  const showXmlPreview = doc.status === "DRAFT" || doc.status === "READY_FOR_TESTING";
  const showSigning =
    doc.status === "READY_FOR_TESTING" ||
    doc.status === "SIGNED" ||
    Boolean(latestJob);
  const showSubmission =
    doc.status === "SIGNED" ||
    doc.status === "SENT" ||
    doc.status === "AUTHORIZED" ||
    doc.status === "REJECTED";

  return (
    <SriModuleShell
      title="Factura SRI"
      description={`${typeLabel} · ${displayNumber}`}
      activeHref={routes.sriDocuments}
      appName="Facturacion"
      appDescription="Comprobantes, estados y seguimiento operativo de facturacion electronica Ecuador / SRI."
      badge="Ecuador / SRI"
      badgeVariant="blue"
    >
      <div className="space-y-5">

        {/* 1. Header compacto */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Comprobante electronico SRI</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {typeLabel} · {displayNumber}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <FacturationStatusBadge label={flowStatus.label} variant={flowStatus.variant} />
              <FacturationStatusBadge
                label={doc.environment === "TEST" ? "Pruebas" : "Produccion"}
                variant="info"
              />
              {doc.sourceType === "BASIC_SALE" && (
                <FacturationStatusBadge
                  label={sourceSale ? "Venta origen disponible" : "Venta origen no disponible"}
                  variant={sourceSale ? "neutral" : "warning"}
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {doc.sourceType === "BASIC_SALE" && sourceSale ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/basic/sales/${sourceSale.id}`}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Ver venta
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={routes.basicSales}>Ventas</Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={routes.sriDocuments}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Volver a SRI
                </Link>
              </Button>
            )}
            {/* XML Firmado — disponible si el documento fue firmado */}
            {(doc.status === "SIGNED" || doc.status === "SENT" || doc.status === "AUTHORIZED") && (
              <SriDownloadButton
                href={`/api/sri/documents/${doc.id}/download-signed-xml`}
                label="XML firmado"
                icon={Download}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
            {/* XML Autorizado — solo si fue autorizado por el SRI */}
            {doc.status === "AUTHORIZED" && (
              <SriDownloadButton
                href={`/api/sri/documents/${doc.id}/download-authorized-xml`}
                label="XML autorizado"
                icon={FileCheck2}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
            {/* RIDE/PDF — solo si autorizado */}
            {doc.status === "AUTHORIZED" && (
              <SriDownloadButton
                href={`/api/sri/documents/${doc.id}/download-ride`}
                label="RIDE / PDF"
                icon={FileText}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#004080] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
          </div>
        </div>

        {/* 2. Tarjeta resumen unificada */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {/* Emisor */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Emisor
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {profile?.legalName ?? "No configurado"}
              </p>
              {profile?.tradeName && (
                <p className="text-xs text-slate-500">{profile.tradeName}</p>
              )}
              <p className="font-mono text-xs text-slate-500">
                RUC: {profile?.ruc ?? "—"}
              </p>
              <p className="text-xs text-slate-500">
                {doc.environment === "TEST" ? "Ambiente: Pruebas" : "Ambiente: Produccion"}
              </p>
            </div>

            {/* Cliente */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Cliente
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {doc.customerName || "Consumidor final"}
              </p>
              {doc.customerIdentification && (
                <p className="font-mono text-xs text-slate-500">
                  {doc.customerIdentification}
                </p>
              )}
              {doc.customerEmail && (
                <p className="text-xs text-slate-500">{doc.customerEmail}</p>
              )}
              {doc.customerPhone && (
                <p className="text-xs text-slate-500">{doc.customerPhone}</p>
              )}
            </div>

            {/* Estructura */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Estructura
              </p>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {displayNumber}
              </p>
              <p className="text-xs text-slate-500">
                Est. {doc.establishment?.code ?? "—"} — {doc.establishment?.name ?? "Sin establecimiento"}
              </p>
              <p className="text-xs text-slate-500">
                Punto: {doc.issuePoint?.code ?? "—"} — {doc.issuePoint?.name ?? "Sin punto de emision"}
              </p>
              {doc.sequentialNumber != null && (
                <p className="font-mono text-xs text-slate-500">
                  Sec: {formatSequentialNumber(doc.sequentialNumber)}
                </p>
              )}
            </div>

            {/* Totales */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Totales
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {money(doc.grandTotal.toString())}
              </p>
              <div className="space-y-0.5 text-xs text-slate-500">
                <p>Subtotal: {money(doc.subtotal.toString())}</p>
                <p>Descuento: {money(doc.discountTotal.toString())}</p>
                <p>IVA: {money(doc.taxTotal.toString())}</p>
              </div>
              <p className="text-xs text-slate-500">
                {new Date(doc.createdAt).toLocaleDateString("es-EC")}
              </p>
            </div>
          </div>

          {/* Clave de acceso */}
          {doc.accessKey && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Clave de acceso
              </p>
              <p className="mt-1 break-all font-mono text-xs leading-relaxed text-slate-700">
                {doc.accessKey}
              </p>
            </div>
          )}
        </div>

        {/* 3. Panel de autorización SRI — solo cuando está autorizado */}
        {doc.status === "AUTHORIZED" && (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
              Autorización SRI
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-500">
                  Número de autorización
                </p>
                <p className="break-all font-mono text-sm font-semibold text-emerald-900">
                  {latestSubmissionJob?.sriAuthorizationNumber ?? "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-500">
                  Fecha de autorización
                </p>
                <p className="text-sm font-semibold text-emerald-900">
                  {latestSubmissionJob?.authorizedAt
                    ? new Date(latestSubmissionJob.authorizedAt).toLocaleString("es-EC", {
                        timeZone: "America/Guayaquil",
                      })
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-500">
                  Ambiente
                </p>
                <p className="text-sm font-semibold text-emerald-900">
                  {doc.environment === "TEST" ? "Pruebas (TEST)" : "Producción"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-emerald-200 pt-4">
              <SriDownloadButton
                href={`/api/sri/documents/${doc.id}/download-signed-xml`}
                label="XML firmado"
                icon={Download}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <SriDownloadButton
                href={`/api/sri/documents/${doc.id}/download-authorized-xml`}
                label="XML autorizado"
                icon={FileCheck2}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <SriDownloadButton
                href={`/api/sri/documents/${doc.id}/download-ride`}
                label="Descargar RIDE / PDF"
                icon={FileText}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
        )}

        {/* 4. Stepper de progreso */}
        <SriDocumentStepper step={stepIndex} isRejected={isRejected} />

        {/* 5. Siguiente accion */}
        <NextActionCard action={nextAction} />

        {/* 6. Detalle de items */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-slate-800">Detalle de items</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Item</th>
                  <th className="pb-2 pr-4 text-right font-medium">Cant.</th>
                  <th className="pb-2 pr-4 text-right font-medium">P. Unit.</th>
                  <th className="pb-2 pr-4 text-right font-medium">IVA %</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {doc.lines.length > 0 ? (
                  doc.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-slate-900">{line.itemName}</p>
                        {line.itemCode && (
                          <p className="font-mono text-xs text-slate-500">{line.itemCode}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-slate-700">
                        {Number(line.quantity)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-700">
                        {money(line.unitPrice.toString())}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-slate-500">
                        {Number(line.taxRate)}%
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-slate-900">
                        {money(line.total.toString())}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-slate-500">
                      No hay lineas disponibles para este documento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-mono">{money(doc.subtotal.toString())}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Descuento</span>
              <span className="font-mono">{money(doc.discountTotal.toString())}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>IVA</span>
              <span className="font-mono">{money(doc.taxTotal.toString())}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <span>Total</span>
              <span className="font-mono">{money(doc.grandTotal.toString())}</span>
            </div>
          </div>
        </div>

        {/* 7. Secciones colapsables */}

        {showChecklist && (
          <SriDocumentCollapsible
            title="Verificacion tecnica"
            badge={checklistBadge.text}
            badgeClass={checklistBadge.cls}
          >
            <SriTechnicalChecklistSection
              documentId={doc.id}
              documentStatus={doc.status}
            />
          </SriDocumentCollapsible>
        )}

        {showXmlPreview && (
          <SriDocumentCollapsible
            title="XML preliminar"
            badge="No valido tributariamente"
            badgeClass="border-amber-200 bg-amber-50 text-amber-700"
          >
            <SriXmlPreviewSection documentId={doc.id} />
          </SriDocumentCollapsible>
        )}

        {showSigning && (
          <SriDocumentCollapsible
            title="Firma electronica"
            badge={signingBadge.text}
            badgeClass={signingBadge.cls}
          >
            <SriSigningJobSection
              documentId={doc.id}
              documentStatus={doc.status}
              readiness={
                signingReadiness
                  ? {
                      canRequestSigning: signingReadiness.canRequestSigning,
                      blockingErrors: signingReadiness.blockingErrors,
                      missingSignatureReasons: signingReadiness.missingSignatureReasons,
                      displayNumber: signingReadiness.displayNumber,
                      accessKey: signingReadiness.accessKey,
                    }
                  : null
              }
            />
          </SriDocumentCollapsible>
        )}

        {showSubmission && (
          <SriDocumentCollapsible
            title={`Envio al SRI${doc.environment === "PRODUCTION" ? " · Produccion" : " · Pruebas"}`}
            badge={submissionBadge.text}
            badgeClass={submissionBadge.cls}
          >
            <SriSubmissionJobSection
              documentId={doc.id}
              documentStatus={doc.status}
            />
          </SriDocumentCollapsible>
        )}

      </div>
    </SriModuleShell>
  );
}
