"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

type SigningJob = {
  id: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type Props = {
  documentId: string;
  documentStatus: string;
  readiness: {
    canRequestSigning: boolean;
    blockingErrors: string[];
    missingSignatureReasons: string[];
    displayNumber: string | null;
    accessKey: string | null;
  } | null;
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  QUEUED: "En cola",
  RUNNING: "Procesando",
  SUCCEEDED: "Worker completado",
  FAILED: "Fallida",
  CANCELLED: "Cancelada",
};

const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  QUEUED: "text-amber-700",
  RUNNING: "text-blue-700",
  SUCCEEDED: "text-emerald-700",
  FAILED: "text-destructive",
  CANCELLED: "text-muted-foreground",
};

const JOB_STATUS_DOT: Record<JobStatus, string> = {
  QUEUED: "bg-amber-400",
  RUNNING: "bg-blue-400 animate-pulse",
  SUCCEEDED: "bg-emerald-500",
  FAILED: "bg-red-500",
  CANCELLED: "bg-slate-300",
};

export function SriSigningJobSection({ documentId, documentStatus, readiness }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<SigningJob | null | undefined>(undefined);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  // undefined = loading, null = no job, object = job
  const loading = job === undefined && fetchError === null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sri/documents/${documentId}/signing-jobs/latest`)
      .then(async (res) => {
        const data = (await res.json()) as { job: SigningJob | null; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Error al consultar jobs de firma.");
        return data.job;
      })
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setFetchError(e instanceof Error ? e.message : "Error al cargar estado de firma.");
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, retryCount]);

  async function handleRequestSigningJob() {
    setRequesting(true);
    setRequestError(null);
    setRequestMessage(null);
    try {
      const res = await fetch(`/api/sri/documents/${documentId}/signing-jobs`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        jobId?: string;
        status?: string;
        alreadyExists?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setRequestError(data.error ?? "Error al solicitar firma.");
        return;
      }

      setRequestMessage(data.message ?? "Solicitud creada.");
      setJob(undefined);
      setFetchError(null);
      setRetryCount((c) => c + 1);
      router.refresh();
    } catch {
      setRequestError("Error de red. Intenta de nuevo.");
    } finally {
      setRequesting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando estado de firma...</p>;
  }

  if (fetchError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{fetchError}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFetchError(null);
            setJob(undefined);
            setRetryCount((c) => c + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const signatureOnlyReasons =
    readiness?.missingSignatureReasons.filter((reason) => reason !== "Ya existe un job en cola/proceso") ?? [];
  const hasChecklistDrift =
    documentStatus === "READY_FOR_TESTING" &&
    (readiness?.blockingErrors.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        La firma XAdES-BES se procesa mediante worker separado. El certificado no se expone al navegador.
      </p>

      {documentStatus === "READY_FOR_TESTING" && readiness?.canRequestSigning && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-semibold">Listo para solicitar firma</p>
          {readiness.displayNumber && (
            <p className="mt-0.5 text-xs">
              Comprobante {readiness.displayNumber}
              {readiness.accessKey ? " con clave persistida y reservada." : "."}
            </p>
          )}
        </div>
      )}

      {documentStatus === "READY_FOR_TESTING" && !readiness?.canRequestSigning && signatureOnlyReasons.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">
            {signatureOnlyReasons.some((r) => r.includes("vencido"))
              ? "El certificado de firma electronica esta vencido"
              : signatureOnlyReasons.some((r) => r.includes("contrase"))
                ? "Falta la contrasena cifrada del certificado"
                : signatureOnlyReasons.some((r) => r.includes("certificado"))
                  ? "Falta cargar el certificado de firma electronica"
                  : "Completa la configuracion de firma electronica"}
          </p>
          <ul className="mt-1 space-y-1 text-xs">
            {signatureOnlyReasons.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
          <Link
            href="/sri/signature"
            className="mt-2 inline-block text-xs underline underline-offset-4"
          >
            Ir a configuracion de firma →
          </Link>
        </div>
      )}

      {hasChecklistDrift && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Revisa el checklist técnico visible</p>
          <p className="mt-0.5 text-xs">
            La firma requiere que el checklist del comprobante siga sin errores bloqueantes.
          </p>
        </div>
      )}

      {/* Estado actual del job */}
      {job ? (
        <div className="rounded-md border p-4">
          <div className="flex items-start gap-3">
            <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${JOB_STATUS_DOT[job.status]}`} />
            <div className="space-y-1 text-sm">
              <p className={`font-semibold ${JOB_STATUS_COLORS[job.status]}`}>
                {JOB_STATUS_LABELS[job.status]}
              </p>
              <p className="text-muted-foreground">
                Solicitado: {new Date(job.createdAt).toLocaleString("es-EC")}
              </p>
              <p className="text-muted-foreground text-xs">
                Intento {job.attempts} de {job.maxAttempts}
              </p>
              {job.errorCode && (
                <p className="text-xs text-destructive font-mono">Código: {job.errorCode}</p>
              )}
              {job.errorMessage && (
                <p className="text-xs text-destructive">{job.errorMessage}</p>
              )}
              {job.status === "SUCCEEDED" && (
                <p className="text-xs text-emerald-700 font-medium">
                  XML firmado correctamente. El comprobante sera enviado al SRI automaticamente.
                </p>
              )}
              {job.status === "FAILED" && (
                <p className="text-xs text-destructive font-medium">
                  La firma fallo. Revisa el error y vuelve a solicitar el proceso cuando corresponda.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : documentStatus === "READY_FOR_TESTING" && readiness?.canRequestSigning ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <p className="font-semibold">Firma electronica configurada</p>
          <p className="mt-0.5 text-xs">
            Este comprobante aun no ha sido firmado. Presiona el boton para solicitar la firma.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No hay solicitud de firma para este comprobante.</p>
      )}

      {/* Mensaje de resultado de la acción */}
      {requestMessage && (
        <p className="text-sm text-emerald-700 font-medium">{requestMessage}</p>
      )}

      {requestError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {requestError.includes("firma electrónica") || requestError.includes("Configura la firma") ? (
            <>
              <p>{requestError}</p>
              <Link
                href="/sri/signature"
                className="text-xs underline underline-offset-4 mt-1 inline-block"
              >
                Ir a configuración de firma →
              </Link>
            </>
          ) : (
            <p>{requestError}</p>
          )}
        </div>
      )}

      {/* Botón de solicitud */}
      {documentStatus === "READY_FOR_TESTING" &&
        readiness?.canRequestSigning &&
        (!job || job.status === "FAILED" || job.status === "CANCELLED") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleRequestSigningJob()}
            disabled={requesting}
          >
            {requesting ? "Solicitando..." : "Solicitar firma"}
          </Button>
        )}

      {(job?.status === "QUEUED" || job?.status === "RUNNING") && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setJob(undefined);
            setFetchError(null);
            setRetryCount((c) => c + 1);
          }}
        >
          Actualizar estado
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        El sistema procesara el envio al SRI y la autorizacion automaticamente.
      </p>
    </div>
  );
}
