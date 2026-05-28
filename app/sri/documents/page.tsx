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

export default async function SriDocumentsPage() {
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
  const documents = await getSriDocuments(tenant.id);

  return (
    <SriModuleShell
      title="Comprobantes electronicos"
      description="Borradores internos preparados desde ventas basicas. La emision real se implementara en la proxima fase."
      activeHref={routes.sriDocuments}
    >
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">Fase de preparacion interna</p>
        <p className="mt-1">
          Estos comprobantes son borradores internos. No han sido firmados ni enviados al SRI.
          La emision real (XML, firma XAdES, autorizacion y RIDE) se implementara en la siguiente fase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Comprobantes preparados ({documents.length})</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.basicSales}>Ir a ventas</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="space-y-2 py-4 text-center text-sm text-muted-foreground">
              <p>Aun no tienes comprobantes preparados.</p>
              <p>
                Puedes crear un borrador desde el detalle de una venta en{" "}
                <Link href={routes.basicSales} className="text-primary underline-offset-4 hover:underline">
                  Inventario & POS → Ventas
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
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
                      {SRI_DOCUMENT_SOURCE_LABELS[doc.sourceType] ?? doc.sourceType} ·{" "}
                      {doc.establishment.code}-{doc.issuePoint.code}
                    </p>
                  </div>

                  <span className="self-start text-xs text-muted-foreground">
                    {doc.lines.length} {doc.lines.length === 1 ? "item" : "items"}
                  </span>

                  <span className="self-start font-mono text-xs font-semibold">
                    {money(doc.grandTotal.toString())}
                  </span>

                  <Button asChild variant="outline" size="sm" className="self-start">
                    <Link href={`/sri/documents/${doc.id}`}>Ver</Link>
                  </Button>
                </div>
              ))}
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
