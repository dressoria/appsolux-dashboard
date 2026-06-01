import Link from "next/link";

import { SriSignatureMetadataForm } from "@/components/appsolux/sri/sri-signature-metadata-form";
import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSriSignatureConfig } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

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
    label: "Lista para pruebas",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-700",
  },
  EXPIRED: {
    label: "Certificado vencido",
    dotClass: "bg-red-400",
    textClass: "text-destructive",
  },
};

const SECURITY_CHECKLIST = [
  "El certificado .p12 no se envía al navegador — la firma ocurre solo server-side.",
  "La contraseña del certificado no se guarda en texto plano ni en base de datos.",
  "La firma XAdES-BES se ejecutará exclusivamente en el servidor, nunca en el cliente.",
  "Para producción se requiere almacenamiento cifrado del certificado (KMS o volumen cifrado).",
];

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
  const statusInfo =
    sigConfig
      ? (STATUS_LABELS[sigConfig.status] ?? STATUS_LABELS.NOT_UPLOADED)
      : STATUS_LABELS.NOT_UPLOADED;

  const isExpired = sigConfig?.expiresAt && sigConfig.expiresAt < new Date();

  return (
    <SriModuleShell
      title="Firma electronica"
      description="El certificado .p12 emitido por el BCE o Security Data es requerido para autorizar comprobantes en el SRI."
      activeHref={routes.sriSignature}
    >
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="font-semibold">Fase de preparación — sin carga real todavía</p>
        <p className="mt-0.5">
          En esta fase se registra únicamente la metadata del certificado. La carga segura del
          archivo .p12 se habilitará cuando esté configurado el almacenamiento cifrado.{" "}
          <strong>No se almacenan contraseñas.</strong>
        </p>
      </div>

      {/* Estado del certificado */}
      <Card>
        <CardHeader>
          <CardTitle>Estado del certificado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border p-4">
            <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${statusInfo.dotClass}`} />
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

              {sigConfig?.serialNumber && (
                <p className="font-mono text-xs text-muted-foreground">
                  Serie: {sigConfig.serialNumber}
                </p>
              )}

              {sigConfig?.fingerprintSha256 && (
                <p className="font-mono text-xs text-muted-foreground break-all">
                  SHA-256: {sigConfig.fingerprintSha256}
                </p>
              )}

              {!sigConfig && (
                <p className="text-muted-foreground">
                  Aún no has registrado metadata de ningún certificado.
                </p>
              )}
            </div>
          </div>

          <SriSignatureMetadataForm />
        </CardContent>
      </Card>

      {/* Checklist de seguridad */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist de seguridad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-2">
            {SECURITY_CHECKLIST.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-xs text-muted-foreground">
            Para más detalles, revisa{" "}
            <span className="font-mono">docs/SRI_SIGNATURE_SECURITY.md</span> en el repositorio.
          </p>
        </CardContent>
      </Card>

      {/* Dónde obtener el certificado */}
      <Card>
        <CardHeader>
          <CardTitle>Donde obtener el certificado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Ecuador exige certificado emitido por entidades autorizadas:</p>
          <ul className="space-y-1">
            <li>• Banco Central del Ecuador (BCE)</li>
            <li>• Security Data</li>
            <li>• ANF AC Ecuador</li>
            <li>• Registro Civil</li>
          </ul>
          <p className="mt-2 text-xs">
            El certificado debe estar emitido a nombre del RUC configurado en la empresa.
            Un certificado para ambiente de pruebas es distinto al de producción.
          </p>
          <p className="mt-1 text-xs">
            Lee también:{" "}
            <Link
              href="/sri/setup"
              className="text-primary underline-offset-4 hover:underline"
            >
              SRI → Configuración
            </Link>{" "}
            para verificar que el perfil tributario esté completo.
          </p>
        </CardContent>
      </Card>

      {/* Procesamiento de firma — arquitectura worker */}
      <Card>
        <CardHeader>
          <CardTitle>Procesamiento de firma — Arquitectura worker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            La firma electrónica XAdES-BES <strong>no se ejecuta desde Next.js directamente.</strong>{" "}
            Se usa una arquitectura de cola de jobs (Camino B):
          </p>
          <ol className="space-y-1.5">
            <li>1. Next.js crea un <code className="font-mono text-xs">SriSigningJob</code> con estado QUEUED.</li>
            <li>2. Un worker separado (proceso independiente) reclama el job.</li>
            <li>3. El worker carga el certificado .p12 desde almacenamiento cifrado (server-side).</li>
            <li>4. El worker firma el XML con XAdES-BES.</li>
            <li>5. El worker guarda el XML firmado y actualiza el job a SUCCEEDED.</li>
            <li>6. El documento queda SIGNED — listo para envío al SRI.</li>
          </ol>
          <ul className="space-y-1 border-t pt-3">
            <li>• El certificado <strong>nunca se envía al navegador</strong>.</li>
            <li>• La contraseña del certificado <strong>no se guarda</strong> en base de datos.</li>
            <li>• Los jobs tienen reintentos automáticos con backoff.</li>
            <li>• El estado de firma es visible en tiempo real desde el detalle del comprobante.</li>
          </ul>
          <p className="text-xs">
            Detalles en{" "}
            <span className="font-mono">docs/SRI_SIGNING_WORKER.md</span>.
          </p>
        </CardContent>
      </Card>

      {/* Próxima fase */}
      <Card>
        <CardHeader>
          <CardTitle>Proxima fase: carga y uso real del certificado</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            <li>1. Configurar almacenamiento cifrado del archivo .p12</li>
            <li>2. Implementar carga segura del certificado (server-side, sin log)</li>
            <li>3. Implementar firma XAdES-BES con la librería adecuada en el worker</li>
            <li>4. Envío real al web service del SRI (ambiente pruebas)</li>
            <li>5. Autorización, número y RIDE del comprobante</li>
          </ol>
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
