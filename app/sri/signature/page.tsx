import { SriSignatureMetadataForm } from "@/components/appsolux/sri/sri-signature-metadata-form";
import { SriSignatureTechnicalInfo } from "@/components/appsolux/sri/sri-signature-technical-info";
import { SriSignatureUploadForm } from "@/components/appsolux/sri/sri-signature-upload-form";
import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSriSignatureConfig } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriSignatureReadiness } from "@/lib/core/sri-signature-readiness";

const STATUS_LABELS: Record<string, { label: string; dotClass: string; textClass: string }> = {
  NOT_UPLOADED: {
    label: "No configurada",
    dotClass: "bg-slate-300",
    textClass: "text-slate-600",
  },
  UPLOADED_METADATA_ONLY: {
    label: "Metadata registrada",
    dotClass: "bg-blue-400",
    textClass: "text-blue-700",
  },
  READY_FOR_TESTING: {
    label: "Firma electrónica lista",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-700",
  },
  EXPIRED: {
    label: "Expirada",
    dotClass: "bg-red-400",
    textClass: "text-destructive",
  },
};

export default async function SriSignaturePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Firma electronica"
        description="Certificado de firma electronica para emision de comprobantes SRI Ecuador."
        activeHref={routes.sriSignature}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const sigConfig = await getSriSignatureConfig(tenant.id);
  const readiness = getSriSignatureReadiness(sigConfig);
  const statusInfo =
    readiness.isReady
      ? STATUS_LABELS.READY_FOR_TESTING
      : sigConfig
      ? (STATUS_LABELS[sigConfig.status] ?? STATUS_LABELS.NOT_UPLOADED)
      : STATUS_LABELS.NOT_UPLOADED;

  const isExpired = readiness.isExpired;
  const hasEncryptedCertificate = Boolean(sigConfig?.encryptedCertificateStorageKey);
  const hasEncryptedPassword = Boolean(sigConfig?.encryptedCertificatePassword);

  return (
    <SriModuleShell
      title="Firma electronica"
      description="El certificado .p12 emitido por el BCE o Security Data es requerido para autorizar comprobantes en el SRI."
      activeHref={routes.sriSignature}
    >
      <div className="space-y-5">

        {/* Estado actual — compacto */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${statusInfo.dotClass}`}
            />
            <div className="space-y-1 text-sm">
              <p className={`font-semibold ${statusInfo.textClass}`}>{statusInfo.label}</p>

              {sigConfig?.certificateFileName && (
                <p className="text-muted-foreground">
                  Archivo: <span className="font-mono">{sigConfig.certificateFileName}</span>
                </p>
              )}
              {sigConfig?.certificateUploadedAt && (
                <p className="text-muted-foreground">
                  Registrado: {sigConfig.certificateUploadedAt.toLocaleDateString("es-EC")}
                </p>
              )}
              {sigConfig?.expiresAt && (
                <p className={isExpired ? "font-semibold text-destructive" : "text-muted-foreground"}>
                  Vence: {sigConfig.expiresAt.toLocaleDateString("es-EC")}
                  {isExpired && " — VENCIDO"}
                </p>
              )}
              {sigConfig?.issuerName && (
                <p className="text-muted-foreground">Emisor: {sigConfig.issuerName}</p>
              )}
              {sigConfig?.subjectName && (
                <p className="text-muted-foreground">Sujeto: {sigConfig.subjectName}</p>
              )}
              {!sigConfig && (
                <p className="text-muted-foreground">
                  Aun no has registrado metadata ni certificado para esta empresa.
                </p>
              )}
            </div>
          </div>

          {/* Estado interno resumido */}
          <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
            {[
              { label: "Metadata registrada", ok: Boolean(sigConfig) },
              { label: "Certificado cifrado", ok: hasEncryptedCertificate },
              { label: "Contrasena cifrada", ok: hasEncryptedPassword },
            ].map(({ label, ok }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs">
                <p className="font-medium text-slate-700">{label}</p>
                <p className={ok ? "text-emerald-700" : "text-amber-700"}>
                  {ok ? "Disponible" : "Pendiente"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mensaje seguridad — una linea */}
        <p className="text-xs text-slate-500 px-1">
          La firma se procesa de forma segura mediante worker. El certificado no se expone al navegador.
        </p>

        {/* Upload form */}
        <SriSignatureUploadForm />

        {/* Metadata form */}
        <SriSignatureMetadataForm />

        {/* Detalles tecnicos — colapsado por defecto */}
        <SriSignatureTechnicalInfo />
      </div>
    </SriModuleShell>
  );
}
