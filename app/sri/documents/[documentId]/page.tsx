import Link from "next/link";

import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getSriDocumentById,
  getSriProfile,
  SRI_DOCUMENT_SOURCE_LABELS,
  SRI_DOCUMENT_STATUS_LABELS,
  SRI_DOCUMENT_TYPE_LABELS,
  formatSequentialNumber,
} from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type Props = { params: Promise<{ documentId: string }> };

function money(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

export default async function SriDocumentDetailPage({ params }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Comprobante"
        description="Detalle del comprobante electronico borrador."
        activeHref={routes.sriDocuments}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;
  const [doc, profile] = await Promise.all([
    getSriDocumentById(tenant.id, documentId),
    getSriProfile(tenant.id),
  ]);

  if (!doc) {
    return (
      <SriModuleShell
        title="Comprobante no encontrado"
        description=""
        activeHref={routes.sriDocuments}
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            El comprobante no existe o no pertenece a esta cuenta.
          </CardContent>
        </Card>
      </SriModuleShell>
    );
  }

  const sourceLabel = SRI_DOCUMENT_SOURCE_LABELS[doc.sourceType] ?? doc.sourceType;
  const statusLabel = SRI_DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status;
  const typeLabel = SRI_DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType;

  return (
    <SriModuleShell
      title={typeLabel}
      description={`${statusLabel} · ${sourceLabel}`}
      activeHref={routes.sriDocuments}
    >
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Borrador interno</p>
        <p className="mt-0.5">
          Este comprobante es un borrador interno. Todavia no fue firmado ni enviado al SRI.
          La emision real se habilitara en la siguiente fase.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Emisor */}
        <Card>
          <CardHeader>
            <CardTitle>Emisor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {profile ? (
              <>
                <p className="font-medium">{profile.legalName}</p>
                {profile.tradeName && (
                  <p className="text-muted-foreground">{profile.tradeName}</p>
                )}
                <p className="font-mono text-muted-foreground">RUC: {profile.ruc}</p>
                <p className="text-muted-foreground">
                  Ambiente: {doc.environment === "TEST" ? "Pruebas" : "Produccion"}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Perfil SRI no configurado.</p>
            )}
          </CardContent>
        </Card>

        {/* Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{doc.customerName}</p>
            {doc.customerIdentification && (
              <p className="font-mono text-muted-foreground">{doc.customerIdentification}</p>
            )}
            {doc.customerEmail && (
              <p className="text-muted-foreground">{doc.customerEmail}</p>
            )}
            {doc.customerPhone && (
              <p className="text-muted-foreground">{doc.customerPhone}</p>
            )}
          </CardContent>
        </Card>

        {/* Establecimiento y punto */}
        <Card>
          <CardHeader>
            <CardTitle>Establecimiento y punto de emision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="font-mono font-semibold">{doc.establishment.code}</span>{" "}
              {doc.establishment.name}
            </p>
            <p className="text-muted-foreground">{doc.establishment.address}</p>
            <p className="mt-2">
              Punto:{" "}
              <span className="font-mono font-semibold">{doc.issuePoint.code}</span>{" "}
              {doc.issuePoint.name}
            </p>
            {doc.sequentialNumber != null && (
              <p className="font-mono text-muted-foreground">
                Secuencial: {formatSequentialNumber(doc.sequentialNumber)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Estado */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del comprobante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Estado:{" "}
              <span className="font-medium">{statusLabel}</span>
            </p>
            <p>Tipo: {typeLabel}</p>
            <p>Origen: {sourceLabel}</p>
            <p className="text-muted-foreground">
              Creado: {new Date(doc.createdAt).toLocaleDateString("es-EC")}
            </p>
            {doc.accessKey && (
              <p className="font-mono text-xs text-muted-foreground break-all">
                Clave: {doc.accessKey}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lineas */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4 text-right">Cant.</th>
                  <th className="pb-2 pr-4 text-right">P. Unit.</th>
                  <th className="pb-2 pr-4 text-right">IVA %</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {doc.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2 pr-4">
                      <p className="font-medium">{line.itemName}</p>
                      {line.itemCode && (
                        <p className="font-mono text-xs text-muted-foreground">{line.itemCode}</p>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">{Number(line.quantity)}</td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {money(line.unitPrice.toString())}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {Number(line.taxRate)}%
                    </td>
                    <td className="py-2 text-right font-mono font-semibold">
                      {money(line.total.toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{money(doc.subtotal.toString())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span className="font-mono">{money(doc.discountTotal.toString())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-mono">{money(doc.taxTotal.toString())}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span className="font-mono">{money(doc.grandTotal.toString())}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={routes.sriDocuments}>Volver a comprobantes</Link>
          </Button>

          {doc.sourceType === "BASIC_SALE" && doc.sourceId && (
            <Button asChild variant="outline">
              <Link href={`/basic/sales/${doc.sourceId}`}>Ver venta origen</Link>
            </Button>
          )}

          <Button disabled variant="outline" title="Disponible en fase de emision real">
            Generar XML
          </Button>
          <Button disabled variant="outline" title="Disponible en fase de emision real">
            Firmar
          </Button>
          <Button disabled variant="outline" title="Disponible en fase de emision real">
            Enviar al SRI
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Las acciones Generar XML, Firmar y Enviar al SRI estaran disponibles en la fase de emision real.
      </p>
    </SriModuleShell>
  );
}
