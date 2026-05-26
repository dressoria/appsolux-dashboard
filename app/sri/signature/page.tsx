import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSriSignatureConfig } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NOT_UPLOADED: { label: "No cargada", color: "text-slate-500" },
  UPLOADED_METADATA_ONLY: { label: "Metadata registrada", color: "text-blue-700" },
  READY_FOR_TESTING: { label: "Lista para pruebas", color: "text-emerald-700" },
  EXPIRED: { label: "Certificado expirado", color: "text-destructive" },
};

export default async function SriSignaturePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Firma electronica"
        description="Estado del certificado de firma electronica para emision de comprobantes."
        activeHref={routes.sriSignature}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const sigConfig = await getSriSignatureConfig(tenant.id);
  const statusInfo = sigConfig ? (STATUS_LABELS[sigConfig.status] ?? STATUS_LABELS.NOT_UPLOADED) : STATUS_LABELS.NOT_UPLOADED;

  return (
    <SriModuleShell
      title="Firma electronica"
      description="El certificado de firma electronica (.p12) es requerido para emitir comprobantes autorizados por el SRI."
      activeHref={routes.sriSignature}
    >
      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">Fase de preparacion — no subas certificados reales todavia</p>
        <p className="mt-1">
          La carga segura del certificado .p12 y la gestion cifrada de la contrasena de firma
          se implementaran en una fase posterior con almacenamiento seguro dedicado.
          En esta fase solo se muestra el estado de configuracion.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado del certificado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border p-4">
            <div className="h-3 w-3 rounded-full bg-slate-300" />
            <div>
              <p className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</p>
              {sigConfig?.certificateFileName && (
                <p className="text-xs text-muted-foreground">
                  Archivo: {sigConfig.certificateFileName}
                </p>
              )}
              {sigConfig?.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Vence: {sigConfig.expiresAt.toLocaleDateString("es-EC")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Que necesitaras en la fase de emision:</p>
            <ul className="space-y-1">
              <li>• Certificado .p12 emitido por el Banco Central del Ecuador o Security Data</li>
              <li>• Contrasena del certificado (se guardara cifrada, nunca en texto plano)</li>
              <li>• El certificado debe estar vigente al momento de emitir</li>
              <li>• Un certificado distinto para ambiente de pruebas y produccion</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Donde obtener un certificado de firma electronica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Ecuador exige firma electronica emitida por entidades certificadoras autorizadas:</p>
          <ul className="space-y-1">
            <li>• Banco Central del Ecuador (BCE)</li>
            <li>• Security Data</li>
            <li>• ANF AC Ecuador</li>
            <li>• Registro Civil</li>
          </ul>
          <p className="mt-2 text-xs">
            Asegurate de que el certificado este a nombre del RUC configurado en la empresa.
          </p>
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
