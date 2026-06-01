import Link from "next/link";

import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { SriSigningJobSection } from "@/components/appsolux/sri/sri-signing-job-section";
import { SriSubmissionJobSection } from "@/components/appsolux/sri/sri-submission-job-section";
import { SriTechnicalChecklistSection } from "@/components/appsolux/sri/sri-technical-checklist-section";
import { SriXmlPreviewSection } from "@/components/appsolux/sri/sri-xml-preview-section";
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
import { getLatestSriSigningJobForDocument } from "@/lib/core/sri-signing-jobs";
import { getLatestSriSubmissionJobForDocument } from "@/lib/core/sri-submission-jobs";
import { getSriDocumentReadinessForSigning } from "@/lib/core/sri-technical-checklist";
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
  const [doc, profile, latestJob, latestSubmissionJob, signingReadiness] = await Promise.all([
    getSriDocumentById(tenant.id, documentId),
    getSriProfile(tenant.id),
    getLatestSriSigningJobForDocument(tenant.id, documentId),
    getLatestSriSubmissionJobForDocument(tenant.id, documentId),
    getSriDocumentReadinessForSigning(tenant.id, documentId),
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
  const banner =
    doc.status === "AUTHORIZED"
      ? {
          title: "Autorizado por SRI",
          text: "El comprobante ya fue autorizado en ambiente de pruebas. El RIDE/PDF final sigue pendiente.",
          className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        }
      : doc.status === "REJECTED"
        ? {
            title: "Rechazado por SRI",
            text:
              latestSubmissionJob?.errorMessage ??
              "El SRI rechazo el comprobante en pruebas. Revisa el detalle del envio para corregirlo.",
            className: "border-red-200 bg-red-50 text-red-800",
          }
      : doc.status === "SENT"
        ? {
            title: "Recibido por SRI",
            text: "El XML ya fue recibido por el SRI y esta pendiente de autorizacion final.",
            className: "border-cyan-200 bg-cyan-50 text-cyan-900",
          }
      : doc.status === "SIGNED"
      ? {
          title: "XML firmado",
          text: "XML firmado. Aun no enviado al SRI.",
          className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        }
      : latestJob?.status === "SUCCEEDED"
        ? {
            title: "Firma procesada por worker",
            text: "Firmado correctamente por worker. Pendiente de envio al SRI en proxima fase.",
            className: "border-emerald-200 bg-emerald-50 text-emerald-800",
          }
        : latestJob?.status === "FAILED"
          ? {
              title: "Firma con error",
              text: latestJob.errorMessage ?? "La ultima ejecucion del worker fallo. Revisa el detalle antes de reintentar.",
              className: "border-red-200 bg-red-50 text-red-800",
            }
          : doc.status === "READY_FOR_TESTING"
            ? {
                title: "Listo para pruebas",
                text: "El documento ya tiene checklist tecnico y XML preliminar. Puedes solicitar firma en ambiente de pruebas.",
                className: "border-blue-200 bg-blue-50 text-blue-800",
              }
            : {
                title: "Borrador interno",
                text: "Este comprobante aun no fue firmado ni enviado al SRI. Sirve como base operativa para la siguiente etapa del flujo.",
                className: "border-amber-200 bg-amber-50 text-amber-800",
              };
  const nextStep =
    doc.status === "AUTHORIZED"
      ? "Comprobante autorizado. La siguiente fase sera generar RIDE/PDF final."
      : doc.status === "REJECTED"
        ? "Revisa la respuesta del SRI, corrige el problema y vuelve a intentar el envio."
      : doc.status === "SENT"
        ? "Consulta nuevamente la autorizacion del SRI desde el worker si el proceso sigue pendiente."
      : doc.status === "SIGNED"
      ? "Siguiente fase: enviar al SRI en ambiente de pruebas."
      : latestJob?.status === "SUCCEEDED"
        ? "Verifica el XML firmado en el worker y prepara la siguiente fase de envio al SRI."
        : latestJob?.status === "FAILED"
          ? "Corrige el problema de firma y vuelve a solicitar el job."
          : doc.status === "READY_FOR_TESTING"
            ? "Solicita firma para crear un job en cola."
            : "Revisa checklist tecnico y XML preliminar antes de marcar listo para pruebas.";

  return (
    <SriModuleShell
      title={typeLabel}
      description={`${statusLabel} · ${sourceLabel}`}
      activeHref={routes.sriDocuments}
    >
      <div className={`rounded-md border p-4 text-sm ${banner.className}`}>
        <p className="font-medium">{banner.title}</p>
        <p className="mt-0.5">
          {banner.text}
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
            {doc.status === "SIGNED" && (
              <p className="text-emerald-700">XML firmado. Aun no enviado al SRI.</p>
            )}
            {doc.status === "SENT" && (
              <p className="text-cyan-700">Recibido por SRI. Pendiente de autorizacion.</p>
            )}
            {doc.status === "AUTHORIZED" && (
              <p className="text-emerald-700">Autorizado por SRI en ambiente de pruebas.</p>
            )}
            {doc.status === "REJECTED" && (
              <p className="text-destructive">SRI rechazo este comprobante en pruebas.</p>
            )}
            {latestJob?.status === "SUCCEEDED" && doc.status !== "SIGNED" && (
              <p className="text-emerald-700">
                Worker completado. Pendiente de verificacion final y de envio al SRI.
              </p>
            )}
            {latestJob?.status === "FAILED" && (
              <p className="text-destructive">
                Error de firma: {latestJob.errorMessage ?? "Revisa el job mas reciente."}
              </p>
            )}
            {latestJob?.signedXmlHash && (
              <p className="font-mono text-xs text-muted-foreground break-all">
                Hash XML firmado: {latestJob.signedXmlHash}
              </p>
            )}
            {latestJob?.signedXmlStorageKey && (
              <p className="text-xs text-muted-foreground">
                Referencia segura del XML firmado: {latestJob.signedXmlStorageKey}
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

      {/* Checklist técnico */}
      {(doc.status === "DRAFT" || doc.status === "READY_FOR_TESTING") && (
        <Card>
          <CardHeader>
            <CardTitle>Verificación técnica</CardTitle>
          </CardHeader>
          <CardContent>
            <SriTechnicalChecklistSection
              documentId={doc.id}
              documentStatus={doc.status}
            />
          </CardContent>
        </Card>
      )}

      {/* XML preliminar */}
      {(doc.status === "DRAFT" || doc.status === "READY_FOR_TESTING") && (
        <Card>
          <CardHeader>
            <CardTitle>XML preliminar</CardTitle>
          </CardHeader>
          <CardContent>
            <SriXmlPreviewSection documentId={doc.id} />
          </CardContent>
        </Card>
      )}

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
            Enviar al SRI
          </Button>
          <Button disabled variant="outline" title="Disponible en fase de emision real">
            RIDE
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Siguiente paso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{nextStep}</p>
        </CardContent>
      </Card>

      {/* Firma electronica — visible si esta listo para pruebas o ya hay job */}
      {(doc.status === "READY_FOR_TESTING" || doc.status === "SIGNED") && (
        <Card>
          <CardHeader>
            <CardTitle>Firma electronica</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {(doc.status === "SIGNED" || doc.status === "SENT" || doc.status === "AUTHORIZED" || doc.status === "REJECTED") && (
        <Card>
          <CardHeader>
            <CardTitle>Envio SRI pruebas</CardTitle>
          </CardHeader>
          <CardContent>
            <SriSubmissionJobSection documentId={doc.id} documentStatus={doc.status} />
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Produccion SRI y RIDE/PDF final permanecen fuera de esta fase.
      </p>
    </SriModuleShell>
  );
}
