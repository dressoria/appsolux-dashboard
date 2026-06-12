import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSearch,
  FolderKanban,
  ReceiptText,
  Settings2,
  Store,
  XCircle,
} from "lucide-react";

import {
  FacturationMetricCard,
  FacturationQuickAction,
  FacturationStatusBadge,
} from "@/components/appsolux/sri/facturation-ui";
import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getSriDocuments,
  getSriModuleStatus,
  SRI_DOCUMENT_TYPE_LABELS,
  SRI_DOCUMENT_SOURCE_LABELS,
} from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const FILTER_TABS = [
  { label: "Todos", status: undefined },
  { label: "Borradores", status: "DRAFT" },
  { label: "Listos", status: "READY_FOR_TESTING" },
  { label: "Firmados", status: "SIGNED" },
  { label: "Con errores", status: "VALIDATION_ERROR" },
] as const;

function signingJobBadgeClass(status: string): string {
  switch (status) {
    case "QUEUED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "RUNNING":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "SUCCEEDED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function signingJobLabel(status: string) {
  switch (status) {
    case "QUEUED":
      return "Firma en cola";
    case "RUNNING":
      return "Firma procesando";
    case "SUCCEEDED":
      return "Firma procesada";
    case "FAILED":
      return "Firma fallida";
    default:
      return "Sin solicitud";
  }
}

function money(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

type Props = { searchParams: Promise<{ status?: string }> };

export default async function SriDocumentsPage({ searchParams }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Comprobantes electronicos"
        description="Lista de comprobantes preparados para emision SRI Ecuador."
        activeHref={routes.sriDocuments}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { status: statusFilter } = await searchParams;
  const [documents, sriStatus] = await Promise.all([
    getSriDocuments(tenant.id, { status: statusFilter }),
    getSriModuleStatus(tenant.id),
  ]);

  const activeTab = FILTER_TABS.find((t) => t.status === statusFilter) ?? FILTER_TABS[0];
  const statusCounts = documents.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.status] = (acc[doc.status] ?? 0) + 1;
    return acc;
  }, {});

  const authorizedCount = statusCounts.AUTHORIZED ?? 0;
  const pendingCount =
    (statusCounts.DRAFT ?? 0) +
    (statusCounts.READY_FOR_TESTING ?? 0) +
    (statusCounts.SIGNED ?? 0) +
    (statusCounts.SENT ?? 0);
  const rejectedCount = statusCounts.REJECTED ?? 0;
  function documentBadge(status: string) {
    if (status === "AUTHORIZED") return { label: "Autorizado", variant: "success" as const };
    if (status === "REJECTED") return { label: "Rechazado", variant: "danger" as const };
    if (status === "SENT") return { label: "Recibido por SRI", variant: "info" as const };
    if (status === "SIGNED") return { label: "Enviando", variant: "info" as const };
    if (status === "READY_FOR_TESTING") return { label: "Preparando", variant: "warning" as const };
    return { label: "Borrador", variant: "neutral" as const };
  }

  return (
    <SriModuleShell
      title="Facturacion"
      description="Comprobantes, estados y seguimiento simple de facturacion electronica Ecuador / SRI."
      activeHref={routes.sriDocuments}
      appName="Facturacion"
      appDescription="Comprobantes, estados y seguimiento operativo de facturacion electronica Ecuador / SRI."
      badge="Ecuador / SRI"
      badgeVariant="blue"
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.95fr] lg:px-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  App de facturacion
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Revisa comprobantes, estados y seguimiento de emision.
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Desde aqui controlas el avance de cada comprobante sin entrar en pasos tecnicos.
                  Las ventas pueden llegar desde POS y la configuracion SRI queda separada como soporte.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FacturationMetricCard
                  icon={FolderKanban}
                  label="Comprobantes"
                  value={String(documents.length)}
                  helper="Total visible en la vista actual."
                  tone="info"
                />
                <FacturationMetricCard
                  icon={CheckCircle2}
                  label="Autorizados"
                  value={String(authorizedCount)}
                  helper="Comprobantes autorizados por SRI."
                  tone="success"
                />
                <FacturationMetricCard
                  icon={Clock3}
                  label="Pendientes"
                  value={String(pendingCount)}
                  helper="Preparando, enviando o pendientes de cierre."
                  tone="warning"
                />
                <FacturationMetricCard
                  icon={XCircle}
                  label="Rechazados"
                  value={String(rejectedCount)}
                  helper="Documentos que requieren correccion."
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Atajos utiles</p>
                  <p className="text-sm text-slate-600">
                    Navega entre ventas, comprobantes y configuracion SRI.
                  </p>
                </div>
                <FacturationStatusBadge
                  label={sriStatus.hasProfile ? "SRI configurado" : "SRI pendiente"}
                  variant={sriStatus.hasProfile ? "success" : "warning"}
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <FacturationQuickAction
                  href={routes.basicSales}
                  title="Ventas"
                  description="Ver recibos internos y ventas origen."
                  icon={ReceiptText}
                />
                <FacturationQuickAction
                  href={routes.sriDocuments}
                  title="Comprobantes"
                  description="Seguir estados y abrir el detalle."
                  icon={FileCheck2}
                />
                <FacturationQuickAction
                  href={routes.sri}
                  title="Configuracion SRI"
                  description="Empresa, firma y secuenciales."
                  icon={Settings2}
                />
                <FacturationQuickAction
                  href={routes.sriCompany}
                  title="Empresa / RUC"
                  description="Actualizar datos tributarios y perfil."
                  icon={Store}
                />
              </div>
            </div>
          </div>
        </section>

      <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              Comprobantes ({documents.length}
              {statusFilter ? ` · ${activeTab.label}` : ""})
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.basicSales}>Ir a ventas</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {FILTER_TABS.map((tab) => {
              const isActive = tab.status === statusFilter || (!statusFilter && !tab.status);
              const href = tab.status ? `?status=${tab.status}` : routes.sriDocuments;
              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          {documents.length === 0 ? (
            <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
              {statusFilter ? (
                <p>No hay comprobantes con este estado.</p>
              ) : (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <FileSearch className="h-6 w-6" />
                  </div>
                  <p>Aun no tienes comprobantes preparados.</p>
                  <p>
                    Puedes iniciar una factura desde una venta en{" "}
                    <Link
                      href={routes.basicSales}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      POS / Ventas
                    </Link>
                    .
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const latestJob = doc.signingJobs[0] ?? null;
                const badge = documentBadge(doc.status);
                const displayNumber =
                  doc.sequentialNumber != null
                    ? `${doc.establishment.code}-${doc.issuePoint.code}-${String(doc.sequentialNumber).padStart(9, "0")}`
                    : null;

                return (
                  <div
                    key={doc.id}
                    className="grid gap-3 rounded-[24px] border border-slate-200 p-4 text-sm md:grid-cols-[auto_1fr_auto_auto_auto]"
                  >
                    <div className="flex flex-wrap gap-1 self-start">
                      <FacturationStatusBadge label={badge.label} variant={badge.variant} />
                      <span
                        className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${signingJobBadgeClass(latestJob?.status ?? "NONE")}`}
                      >
                        {signingJobLabel(latestJob?.status ?? "NONE")}
                      </span>
                    </div>

                    <div>
                      <p className="font-medium text-slate-900">{doc.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {SRI_DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType} ·{" "}
                        {SRI_DOCUMENT_SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
                      </p>
                      {displayNumber ? (
                        <p className="font-mono text-xs text-slate-500">{displayNumber}</p>
                      ) : (
                        <p className="text-xs text-slate-400">
                          {doc.establishment.code}-{doc.issuePoint.code} · sin secuencial
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {doc.status === "AUTHORIZED"
                          ? "Comprobante autorizado y listo para seguimiento."
                          : doc.status === "SENT"
                            ? "Recibido por SRI. Pendiente de autorizacion."
                            : doc.status === "SIGNED"
                              ? "Factura preparada y en proceso de envio."
                              : doc.status === "READY_FOR_TESTING"
                                ? "Factura preparada para continuar su emision."
                                : latestJob
                                  ? `Ultimo paso: ${signingJobLabel(latestJob.status)}`
                                  : "Aun no se ha iniciado el flujo de firma."}
                      </p>
                    </div>

                    <span className="self-start text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString("es-EC")}
                    </span>

                    <span className="self-start font-mono text-xs font-semibold">
                      {money(doc.grandTotal.toString())}
                    </span>

                    <Button asChild variant="outline" size="sm" className="self-start">
                      <Link href={`/sri/documents/${doc.id}`}>Ver</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
        <CardHeader>
          <CardTitle>Lectura rapida del flujo</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            <li>1. Preparando: la factura nace desde la venta y queda lista para continuar.</li>
            <li>2. Enviando: el XML firmado entra al flujo de pruebas del SRI.</li>
            <li>3. Recibido por SRI: el comprobante espera autorizacion final.</li>
            <li>4. Autorizado: el comprobante ya paso validacion del SRI.</li>
            <li>5. Rechazado: requiere correccion antes de emitir un nuevo documento.</li>
          </ol>
        </CardContent>
      </Card>
      </div>
    </SriModuleShell>
  );
}
