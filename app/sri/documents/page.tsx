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
    case "AUTHORIZED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
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
      description="Borradores internos preparados desde ventas basicas. No firmados ni autorizados por el SRI."
      activeHref={routes.sriDocuments}
    >
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Estos comprobantes son preliminares.{" "}
        <span className="font-semibold">No están firmados ni autorizados por el SRI</span>{" "}
        y no tienen validez tributaria. La firma y autorización real se implementarán en la siguiente fase.
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
                const displayNumber =
                  doc.sequentialNumber != null
                    ? `${doc.establishment.code}-${doc.issuePoint.code}-${String(doc.sequentialNumber).padStart(9, "0")}`
                    : null;

                return (
                  <div
                    key={doc.id}
                    className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[auto_1fr_auto_auto_auto]"
                  >
                    <span
                      className={`self-start inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${statusBadgeClass(doc.status)}`}
                    >
                      {SRI_DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                    </span>

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
          <CardTitle>Proxima fase: emision real</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            <li>1. Generacion de XML segun esquema SRI</li>
            <li>2. Firma digital con certificado .p12 (XAdES-BES)</li>
            <li>3. Envio al web service del SRI (pruebas o produccion)</li>
            <li>4. Recepcion de clave de acceso y numero de autorizacion</li>
            <li>5. Generacion de RIDE (representacion impresa)</li>
            <li>6. Envio por correo al cliente (opcional)</li>
          </ol>
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
