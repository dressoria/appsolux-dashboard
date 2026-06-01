import Link from "next/link";

import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSriModuleStatus } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function StatusRow({
  label,
  value,
  ok,
  href,
  actionLabel,
}: {
  label: string;
  value: string;
  ok: boolean;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <div className="space-y-0.5">
        <p className="font-medium">{label}</p>
        <p className={ok ? "text-emerald-700" : "text-amber-700"}>{value}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={href}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function getTaxConfigurationLabel(status: Awaited<ReturnType<typeof getSriModuleStatus>>) {
  const complete =
    status.profileStatus === "CONFIGURED" &&
    status.establishmentCount > 0 &&
    status.issuePointCount > 0 &&
    status.sequenceCount > 0;

  if (complete) return "Configurado";
  if (!status.hasProfile) return "Pendiente";
  return "Incompleto";
}

function getSignatureLabel(status: Awaited<ReturnType<typeof getSriModuleStatus>>) {
  if (status.signatureStatus === "EXPIRED") return "Expirada";
  if (status.signatureStatus === "READY_FOR_TESTING") return "Lista para pruebas";
  if (status.signatureHasEncryptedCertificate && status.signatureHasEncryptedPassword) {
    return "Certificado cargado para pruebas";
  }
  if (status.signatureHasEncryptedCertificate) return "Certificado cargado";
  if (status.signatureStatus === "UPLOADED_METADATA_ONLY") return "Metadata registrada";
  return "No configurada";
}

function getDocumentLabel(status: Awaited<ReturnType<typeof getSriModuleStatus>>) {
  if (status.documentStatusCounts.signed > 0) {
    return `${status.documentStatusCounts.signed} firmado(s) · pendiente envio SRI`;
  }
  if (status.documentStatusCounts.readyForTesting > 0) {
    return `${status.documentStatusCounts.readyForTesting} listo(s) para pruebas`;
  }
  if (status.documentStatusCounts.draft > 0) {
    return `${status.documentStatusCounts.draft} borrador(es)`;
  }
  return "Sin comprobantes";
}

function getRecommendedStep(status: Awaited<ReturnType<typeof getSriModuleStatus>>) {
  if (!status.hasProfile) {
    return {
      text: "Completa Empresa / RUC.",
      href: routes.sriCompany,
      actionLabel: "Configurar empresa",
      variant: "default" as const,
    };
  }

  if (status.establishmentCount === 0) {
    return {
      text: "Configura al menos un establecimiento.",
      href: routes.sriEstablishments,
      actionLabel: "Agregar establecimiento",
      variant: "default" as const,
    };
  }

  if (status.issuePointCount === 0) {
    return {
      text: "Configura al menos un punto de emision.",
      href: routes.sriIssuePoints,
      actionLabel: "Agregar punto de emision",
      variant: "default" as const,
    };
  }

  if (status.sequenceCount === 0) {
    return {
      text: "Configura secuencial de factura.",
      href: routes.sriSequences,
      actionLabel: "Configurar secuenciales",
      variant: "default" as const,
    };
  }

  if (!status.signatureStatus || status.signatureStatus === "NOT_UPLOADED") {
    return {
      text: "Configura la firma electronica.",
      href: routes.sriSignature,
      actionLabel: "Ver firma",
      variant: "outline" as const,
    };
  }

  if (
    status.signatureStatus === "UPLOADED_METADATA_ONLY" &&
    (!status.signatureHasEncryptedCertificate || !status.signatureHasEncryptedPassword)
  ) {
    return {
      text: "Carga el certificado .p12/.pfx de la empresa para pruebas controladas.",
      href: routes.sriSignature,
      actionLabel: "Revisar firma",
      variant: "outline" as const,
    };
  }

  if (status.documentStatusCounts.signed > 0) {
    return {
      text: "Siguiente fase: envio al SRI en ambiente de pruebas.",
      href: routes.sriDocuments,
      actionLabel: "Ver comprobantes",
      variant: "outline" as const,
    };
  }

  return {
    text: "Crea una venta, genera borrador SRI, marca listo para pruebas y solicita firma.",
    href: routes.sriDocuments,
    actionLabel: "Ir a comprobantes",
    variant: "outline" as const,
  };
}

export default async function SriPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Facturacion Electronica Ecuador"
        description="Configura empresa, establecimientos, secuenciales, firma electronica y comprobantes."
        activeHref={routes.sri}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const status = await getSriModuleStatus(tenant.id);
  const recommendedStep = getRecommendedStep(status);
  const taxConfigurationLabel = getTaxConfigurationLabel(status);
  const signatureLabel = getSignatureLabel(status);
  const documentLabel = getDocumentLabel(status);

  return (
    <SriModuleShell
      title="Facturacion Electronica Ecuador"
      description="Configura empresa, establecimientos, secuenciales, firma electronica y comprobantes para emitir documentos electronicos."
      activeHref={routes.sri}
    >
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">Ruta actual del modulo SRI</p>
        <p className="mt-1">
          El modulo ya cuenta con configuracion tributaria, clave de acceso, XML preliminar,
          checklist tecnico y cola de firma por worker. En esta etapa todavia siguen pendientes
          el envio al SRI, la autorizacion oficial y el RIDE/PDF final.
        </p>
      </div>

      {status.environment === "TEST" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Estas trabajando en ambiente de pruebas. No se emiten comprobantes con validez tributaria.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Empresa / RUC</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {status.hasProfile ? status.ruc : "—"}
            </p>
            <p className={`mt-1 text-xs ${status.profileStatus === "CONFIGURED" ? "text-emerald-700" : "text-amber-700"}`}>
              {status.profileStatus === "CONFIGURED" ? "Configurado" : "Pendiente"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Establecimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{status.establishmentCount}</p>
            <p className={`mt-1 text-xs ${status.establishmentCount > 0 ? "text-emerald-700" : "text-amber-700"}`}>
              {status.establishmentCount > 0 ? "Configurados" : "Sin configurar"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Puntos de emision</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{status.issuePointCount}</p>
            <p className={`mt-1 text-xs ${status.issuePointCount > 0 ? "text-emerald-700" : "text-amber-700"}`}>
              {status.issuePointCount > 0 ? "Configurados" : "Sin configurar"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Secuenciales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{status.sequenceCount}</p>
            <p className={`mt-1 text-xs ${status.sequenceCount > 0 ? "text-emerald-700" : "text-amber-700"}`}>
              {status.sequenceCount > 0 ? "Configurados" : "Sin configurar"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado de configuracion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              label="Configuracion tributaria"
              value={taxConfigurationLabel}
              ok={taxConfigurationLabel === "Configurado"}
              href={routes.sriCompany}
              actionLabel="Ver configuracion"
            />
            <StatusRow
              label="Empresa y RUC"
              value={status.profileStatus === "CONFIGURED" ? "Configurado" : "Pendiente"}
              ok={status.profileStatus === "CONFIGURED"}
              href={routes.sriCompany}
              actionLabel={status.profileStatus === "CONFIGURED" ? "Editar" : "Configurar"}
            />
            <StatusRow
              label="Establecimientos"
              value={status.establishmentCount > 0 ? `${status.establishmentCount} activos` : "Sin establecimientos"}
              ok={status.establishmentCount > 0}
              href={routes.sriEstablishments}
              actionLabel={status.establishmentCount > 0 ? "Ver" : "Agregar"}
            />
            <StatusRow
              label="Puntos de emision"
              value={status.issuePointCount > 0 ? `${status.issuePointCount} activos` : "Sin puntos de emision"}
              ok={status.issuePointCount > 0}
              href={routes.sriIssuePoints}
              actionLabel={status.issuePointCount > 0 ? "Ver" : "Agregar"}
            />
            <StatusRow
              label="Secuenciales"
              value={status.sequenceCount > 0 ? `${status.sequenceCount} configurados` : "Sin secuenciales"}
              ok={status.sequenceCount > 0}
              href={routes.sriSequences}
              actionLabel={status.sequenceCount > 0 ? "Ver" : "Configurar"}
            />
            <StatusRow
              label="Ambiente"
              value={
                status.environment === "TEST"
                  ? "Pruebas (TEST)"
                  : status.environment === "PRODUCTION"
                  ? "Produccion"
                  : "No configurado"
              }
              ok={status.environment !== null}
              href={routes.sriEnvironment}
              actionLabel="Ver ambiente"
            />
            <StatusRow
              label="Firma electronica"
              value={signatureLabel}
              ok={status.signatureStatus === "READY_FOR_TESTING"}
              href={routes.sriSignature}
              actionLabel="Ver firma"
            />
            <StatusRow
              label="Contrasena cifrada"
              value={status.signatureHasEncryptedPassword ? "Registrada" : "Pendiente"}
              ok={status.signatureHasEncryptedPassword}
              href={routes.sriSignature}
              actionLabel="Revisar firma"
            />
            <StatusRow
              label="Documentos"
              value={documentLabel}
              ok={status.documentCount > 0}
              href={routes.sriDocuments}
              actionLabel="Ver documentos"
            />
            <StatusRow
              label="Autorizacion SRI"
              value="Pendiente de implementacion"
              ok={false}
              href={routes.sriDocuments}
              actionLabel="Ver flujo"
            />
            <StatusRow
              label="RIDE / PDF"
              value="Pendiente de implementacion"
              ok={false}
              href={routes.sriDocuments}
              actionLabel="Ver flujo"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proximo paso recomendado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm">{recommendedStep.text}</p>
              <Button asChild variant={recommendedStep.variant}>
                <Link href={recommendedStep.href}>{recommendedStep.actionLabel}</Link>
              </Button>
            </div>
            {status.readinessLabel === "ready_for_testing" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Configuracion lista para pruebas. Antes de emitir en produccion, valida una firma real en ambiente de pruebas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comprobantes soportados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { type: "Factura", code: "01", status: "Flujo inicial activo", detail: "Borrador, XML, checklist y firma en avance." },
            { type: "Nota de credito", code: "04", status: "Estructura pendiente", detail: "Aun no hay flujo operativo completo." },
            { type: "Nota de debito", code: "05", status: "Estructura pendiente", detail: "Aun no hay flujo operativo completo." },
            { type: "Retencion", code: "07", status: "Estructura pendiente", detail: "Aun no hay flujo operativo completo." },
            { type: "Guia de remision", code: "06", status: "Estructura pendiente", detail: "Aun no hay flujo operativo completo." },
          ].map((doc) => (
            <div key={doc.code} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{doc.type}</p>
              <p className="text-xs text-muted-foreground">Tipo {doc.code}</p>
              <p className={`mt-1 text-xs ${doc.code === "01" ? "text-emerald-700" : "text-amber-700"}`}>
                {doc.status}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{doc.detail}</p>
            </div>
          ))}
        </CardContent>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          Por ahora el flujo operativo se concentra en Factura. Los demas comprobantes estan contemplados en estructura, pero se activaran despues.
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
