import Link from "next/link";
import { FileSearch } from "lucide-react";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { FacturationStatusBadge } from "@/components/appsolux/sri/facturation-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getSriDocuments,
  SRI_DOCUMENT_SOURCE_LABELS,
  SRI_DOCUMENT_TYPE_LABELS,
} from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const FILTER_TABS = [
  { label: "Todos", status: undefined },
  { label: "Borradores", status: "DRAFT" },
  { label: "Listos", status: "READY_FOR_TESTING" },
  { label: "Firmados", status: "SIGNED" },
  { label: "Enviados", status: "SENT" },
  { label: "Autorizados", status: "AUTHORIZED" },
  { label: "Rechazados", status: "REJECTED" },
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

function documentBadge(status: string) {
  if (status === "AUTHORIZED") return { label: "Autorizado", variant: "success" as const };
  if (status === "REJECTED") return { label: "Rechazado", variant: "danger" as const };
  if (status === "SENT") return { label: "Recibido por SRI", variant: "info" as const };
  if (status === "SIGNED") return { label: "Firmado", variant: "info" as const };
  if (status === "READY_FOR_TESTING") return { label: "Listo para firma", variant: "warning" as const };
  return { label: "Borrador", variant: "neutral" as const };
}

type Props = { searchParams: Promise<{ status?: string }> };

export default async function SriDocumentsPage({ searchParams }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Documentos SRI generados"
        description="Listado técnico de comprobantes electrónicos SRI."
        activeHref={routes.sriDocuments}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { status: statusFilter } = await searchParams;
  const documents = await getSriDocuments(tenant.id, { status: statusFilter });

  const activeTab = FILTER_TABS.find((tab) => tab.status === statusFilter) ?? FILTER_TABS[0];

  return (
    <BasicModuleShell
      title="Documentos SRI generados"
      description="Comprobantes electrónicos emitidos desde ventas. Vista técnica para seguimiento y descargas."
      activeHref={routes.sriDocuments}
    >
      <div className="space-y-5">
        <Card className="rounded-[24px] border-slate-200 py-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                Documentos ({documents.length}
                {statusFilter ? ` · ${activeTab.label}` : ""})
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.basicSales}>Ir a documentos de venta</Link>
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
                        ? "border-[#004080] bg-[#004080] text-white"
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
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <FileSearch className="h-6 w-6" />
                </div>
                <p>
                  {statusFilter
                    ? "No hay documentos SRI con este estado."
                    : "Aun no hay documentos SRI generados."}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.map((doc) => {
                  const latestJob = doc.signingJobs[0] ?? null;
                  const badge = documentBadge(doc.status);
                  const displayNumber =
                    doc.sequentialNumber != null
                      ? `${doc.establishment.code}-${doc.issuePoint.code}-${String(doc.sequentialNumber).padStart(9, "0")}`
                      : `${doc.establishment.code}-${doc.issuePoint.code} · pendiente`;

                  return (
                    <div
                      key={doc.id}
                      className="grid gap-3 rounded-[20px] border border-slate-200 bg-white p-4 text-sm md:grid-cols-[1.5fr_120px_110px_auto]"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-2">
                          <FacturationStatusBadge label={badge.label} variant={badge.variant} />
                          <span
                            className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${signingJobBadgeClass(latestJob?.status ?? "NONE")}`}
                          >
                            {signingJobLabel(latestJob?.status ?? "NONE")}
                          </span>
                        </div>

                        <p className="font-medium text-slate-900">{doc.customerName || "Consumidor final"}</p>
                        <p className="font-mono text-xs text-slate-500">{displayNumber}</p>
                        <p className="text-xs text-slate-500">
                          {SRI_DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                          {" · "}
                          {SRI_DOCUMENT_SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
                        </p>
                        {doc.sourceType === "BASIC_SALE" && doc.sourceId ? (
                          <p className="text-xs text-slate-400">Venta interna: {doc.sourceId}</p>
                        ) : null}
                      </div>

                      <div className="space-y-1 text-xs text-slate-500">
                        <p>Fecha</p>
                        <p className="font-medium text-slate-800">
                          {new Date(doc.createdAt).toLocaleString("es-EC", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="space-y-1 text-xs text-slate-500">
                        <p>Total</p>
                        <p className="font-mono text-sm font-semibold text-slate-900">
                          {money(doc.grandTotal.toString())}
                        </p>
                      </div>

                      <div className="flex items-start justify-end">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/sri/documents/${doc.id}`}>Ver documento</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BasicModuleShell>
  );
}
