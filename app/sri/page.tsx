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

  return (
    <SriModuleShell
      title="Facturacion Electronica Ecuador"
      description="Configura empresa, establecimientos, secuenciales, firma electronica y comprobantes para emitir documentos electronicos."
      activeHref={routes.sri}
    >
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">Fase de configuracion</p>
        <p className="mt-1">
          Esta fase prepara la configuracion tributaria. La emision real, autorizacion SRI,
          generacion de XML y RIDE se implementaran en una fase posterior.
          No subas certificados reales todavia.
        </p>
      </div>

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
              value={
                status.signatureStatus === "READY_FOR_TESTING"
                  ? "Lista para pruebas"
                  : status.signatureStatus === "UPLOADED_METADATA_ONLY"
                  ? "Metadata registrada"
                  : status.signatureStatus === "EXPIRED"
                  ? "Expirada"
                  : "No cargada"
              }
              ok={status.signatureStatus === "READY_FOR_TESTING"}
              href={routes.sriSignature}
              actionLabel="Ver firma"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proximo paso recomendado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!status.hasProfile && (
              <div className="space-y-2">
                <p className="text-sm">Comienza configurando los datos de tu empresa y RUC.</p>
                <Button asChild>
                  <Link href={routes.sriCompany}>Configurar empresa</Link>
                </Button>
              </div>
            )}
            {status.hasProfile && status.establishmentCount === 0 && (
              <div className="space-y-2">
                <p className="text-sm">Agrega tu primer establecimiento (ejemplo: 001).</p>
                <Button asChild>
                  <Link href={routes.sriEstablishments}>Agregar establecimiento</Link>
                </Button>
              </div>
            )}
            {status.hasProfile && status.establishmentCount > 0 && status.issuePointCount === 0 && (
              <div className="space-y-2">
                <p className="text-sm">Agrega un punto de emision a tu establecimiento (ejemplo: 001).</p>
                <Button asChild>
                  <Link href={routes.sriIssuePoints}>Agregar punto de emision</Link>
                </Button>
              </div>
            )}
            {status.hasProfile && status.issuePointCount > 0 && status.sequenceCount === 0 && (
              <div className="space-y-2">
                <p className="text-sm">Configura los secuenciales para cada tipo de comprobante.</p>
                <Button asChild>
                  <Link href={routes.sriSequences}>Configurar secuenciales</Link>
                </Button>
              </div>
            )}
            {status.hasProfile && status.sequenceCount > 0 && status.signatureStatus !== "READY_FOR_TESTING" && (
              <div className="space-y-2">
                <p className="text-sm">
                  La carga segura del certificado de firma electronica se implementara en una fase posterior.
                </p>
                <Button asChild variant="outline">
                  <Link href={routes.sriSignature}>Ver estado de firma</Link>
                </Button>
              </div>
            )}
            {status.readinessLabel === "ready_for_testing" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Configuracion lista para pruebas. La emision real se habilitara en la siguiente fase.
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
            { type: "Factura", code: "01" },
            { type: "Nota de credito", code: "04" },
            { type: "Nota de debito", code: "05" },
            { type: "Retencion", code: "07" },
            { type: "Guia de remision", code: "06" },
          ].map((doc) => (
            <div key={doc.code} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{doc.type}</p>
              <p className="text-xs text-muted-foreground">Tipo {doc.code}</p>
              <p className="mt-1 text-xs text-blue-600">Estructura preparada</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
