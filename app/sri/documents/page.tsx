import Link from "next/link";

import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getSriDocuments,
  SRI_DOCUMENT_STATUS_LABELS,
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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "DRAFT":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "READY_FOR_TESTING":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "VALIDATION_ERROR":
      return "border-red-200 bg-red-50 text-red-700";
    case "SIGNED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "AUTHORIZED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

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
  const documents = await getSriDocuments(tenant.id, { status: statusFilter });

  const activeTab = FILTER_TABS.find((t) => t.status === statusFilter) ?? FILTER_TABS[0];

  return (
    <SriModuleShell
      title="Comprobantes electronicos"
      description="Borradores internos, documentos listos para pruebas y XML firmados pendientes de envio al SRI."
      activeHref={routes.sriDocuments}
    >
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Este listado mezcla borradores, comprobantes listos para pruebas y XML firmados.
        <span className="font-semibold"> La autorizacion oficial del SRI y el RIDE todavia no estan activos.</span>
      </div>

      <Card>
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

          {/* Filtros de estado */}
          <div className="flex flex-wrap gap-1 pt-1">
            {FILTER_TABS.map((tab) => {
              const isActive = tab.status === statusFilter || (!statusFilter && !tab.status);
              const href = tab.status ? `?status=${tab.status}` : routes.sriDocuments;
              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
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
            <div className="space-y-2 py-4 text-center text-sm text-muted-foreground">
              {statusFilter ? (
                <p>No hay comprobantes con este estado.</p>
              ) : (
                <>
                  <p>Aun no tienes comprobantes preparados.</p>
                  <p>
                    Puedes crear un borrador desde el detalle de una venta en{" "}
                    <Link
                      href={routes.basicSales}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Inventario & POS → Ventas
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
                const displayNumber =
                  doc.sequentialNumber != null
                    ? `${doc.establishment.code}-${doc.issuePoint.code}-${String(doc.sequentialNumber).padStart(9, "0")}`
                    : null;

                return (
                  <div
                    key={doc.id}
                    className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[auto_1fr_auto_auto_auto]"
                  >
                    <div className="flex flex-wrap gap-1 self-start">
                      <span
                        className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${statusBadgeClass(doc.status)}`}
                      >
                        {doc.status === "SIGNED"
                          ? "Firmado, pendiente de envio al SRI"
                          : SRI_DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                      </span>
                      <span
                        className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${signingJobBadgeClass(latestJob?.status ?? "NONE")}`}
                      >
                        {signingJobLabel(latestJob?.status ?? "NONE")}
                      </span>
                    </div>

                    <div>
                      <p className="font-medium">{doc.customerName}</p>
                      <p className="text-xs text-muted-foreground">
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
                      <p className="text-xs text-muted-foreground">
                        {doc.status === "SIGNED"
                          ? "XML firmado guardado. Falta envio al SRI."
                          : latestJob
                            ? `Ultimo job: ${signingJobLabel(latestJob.status)}`
                            : "Aun no se ha solicitado firma."}
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

      <Card>
        <CardHeader>
          <CardTitle>Siguientes fases del flujo</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            <li>1. Revisar checklist tecnico y XML preliminar.</li>
            <li>2. Solicitar firma al worker para pruebas controladas.</li>
            <li>3. Habilitar envio al web service del SRI en pruebas.</li>
            <li>4. Implementar autorizacion SRI y numero oficial.</li>
            <li>5. Implementar RIDE/PDF y entrega final al cliente.</li>
          </ol>
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
