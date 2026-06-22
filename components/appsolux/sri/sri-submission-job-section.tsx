"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type SubmissionJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "RECEIVED"
  | "AUTHORIZED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED";

type SubmissionJob = {
  id: string;
  status: SubmissionJobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  receivedAt: string | null;
  authorizedAt: string | null;
  sriAuthorizationNumber: string | null;
  sriAccessKey: string | null;
  sriReceiptStatus: string | null;
  sriAuthorizationStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type Props = {
  documentId: string;
  documentStatus: string;
};

const JOB_STATUS_DOT: Record<SubmissionJobStatus, string> = {
  QUEUED: "bg-amber-400",
  RUNNING: "bg-blue-400 animate-pulse",
  RECEIVED: "bg-cyan-500",
  AUTHORIZED: "bg-emerald-500",
  REJECTED: "bg-red-500",
  FAILED: "bg-red-500",
  CANCELLED: "bg-slate-300",
};

const JOB_STATUS_LABEL: Record<SubmissionJobStatus, string> = {
  QUEUED: "En cola",
  RUNNING: "Procesando",
  RECEIVED: "Recibido por SRI",
  AUTHORIZED: "Autorizado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

const JOB_STATUS_COLOR: Record<SubmissionJobStatus, string> = {
  QUEUED: "text-amber-700",
  RUNNING: "text-blue-700",
  RECEIVED: "text-cyan-700",
  AUTHORIZED: "text-emerald-700",
  REJECTED: "text-red-700",
  FAILED: "text-destructive",
  CANCELLED: "text-muted-foreground",
};

export function SriSubmissionJobSection({ documentId, documentStatus }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<SubmissionJob | null | undefined>(undefined);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const loading = job === undefined && fetchError === null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sri/documents/${documentId}/submission-jobs/latest`)
      .then(async (res) => {
        const data = (await res.json()) as { job: SubmissionJob | null; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Error al consultar envio SRI.");
        return data.job;
      })
      .then((data) => { if (!cancelled) setJob(data); })
      .catch((error: unknown) => {
        if (!cancelled)
          setFetchError(error instanceof Error ? error.message : "Error al cargar el envio SRI.");
      });
    return () => { cancelled = true; };
  }, [documentId, retryCount]);

  async function handleCreateSubmissionJob() {
    setRequesting(true);
    setRequestError(null);
    setRequestMessage(null);
    try {
      const response = await fetch(`/api/sri/documents/${documentId}/submission-jobs`, {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setRequestError(data.error ?? "No se pudo reenviar al SRI.");
        return;
      }
      setRequestMessage(data.message ?? "Envio solicitado.");
      setJob(undefined);
      setFetchError(null);
      setRetryCount((c) => c + 1);
      router.refresh();
    } catch {
      setRequestError("Error de red. Intenta nuevamente.");
    } finally {
      setRequesting(false);
    }
  }

  if (
    documentStatus !== "SIGNED" &&
    documentStatus !== "SENT" &&
    documentStatus !== "AUTHORIZED" &&
    documentStatus !== "REJECTED"
  ) {
    return (
      <p className="text-sm text-muted-foreground">
        Disponible una vez que el comprobante este firmado.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando estado de envio...</p>;
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

  const canRetry =
    !job ||
    job.status === "FAILED" ||
    job.status === "CANCELLED";

  const isInProgress =
    job?.status === "QUEUED" ||
    job?.status === "RUNNING" ||
    job?.status === "RECEIVED";

  return (
    <div className="space-y-4">

      {/* Estado sin job — comprobante firmado esperando envio automatico */}
      {documentStatus === "SIGNED" && !job && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <p className="font-semibold">Enviando al SRI automaticamente</p>
          <p className="mt-0.5 text-xs">
            El sistema procesara el envio sin que tengas que hacer nada. Actualiza la pagina en unos
            segundos para ver el resultado.
          </p>
        </div>
      )}

      {/* Estado con job */}
      {job && (
        <div className="rounded-md border p-4">
          <div className="flex items-start gap-3">
            <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${JOB_STATUS_DOT[job.status]}`} />
            <div className="space-y-1 text-sm">
              <p className={`font-semibold ${JOB_STATUS_COLOR[job.status]}`}>
                {JOB_STATUS_LABEL[job.status]}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(job.createdAt).toLocaleString("es-EC")}
              </p>

              {job.status === "QUEUED" && (
                <p className="text-xs text-muted-foreground">
                  El comprobante esta en cola para ser enviado al SRI.
                </p>
              )}

              {job.status === "RUNNING" && (
                <p className="text-xs text-blue-700">
                  Enviando al SRI...
                </p>
              )}

              {job.status === "RECEIVED" && (
                <p className="text-xs text-cyan-700">
                  Recibido por el SRI. Esperando autorizacion...
                </p>
              )}

              {job.status === "AUTHORIZED" && (
                <p className="text-xs text-emerald-700 font-medium">
                  Autorizado por el SRI. Descarga el RIDE/PDF y los XML desde el panel superior.
                </p>
              )}

              {job.status === "REJECTED" && (
                <p className="text-xs text-red-700 font-medium">
                  Rechazado por el SRI. No reenvies este comprobante; crea uno nuevo.
                </p>
              )}

              {job.status === "FAILED" && (
                <p className="text-xs text-destructive font-medium">
                  No se pudo completar el envio al SRI.
                </p>
              )}

              {job.sriAuthorizationNumber && (
                <p className="font-mono text-xs text-muted-foreground break-all">
                  No. autorizacion: {job.sriAuthorizationNumber}
                </p>
              )}

              {job.authorizedAt && (
                <p className="text-xs text-emerald-700">
                  Autorizado: {new Date(job.authorizedAt).toLocaleString("es-EC")}
                </p>
              )}

              {(job.errorCode || job.errorMessage) && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-slate-700">
                    Ver detalle del error
                  </summary>
                  <div className="mt-1 space-y-0.5">
                    {job.errorCode && (
                      <p className="font-mono text-xs text-destructive">Codigo: {job.errorCode}</p>
                    )}
                    {job.errorMessage && (
                      <p className="text-xs text-destructive">{job.errorMessage}</p>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {requestMessage && (
        <p className="text-sm text-emerald-700 font-medium">{requestMessage}</p>
      )}

      {requestError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {requestError}
        </div>
      )}

      {/* Botones de accion */}
      <div className="flex flex-wrap gap-2">
        {/* Actualizar: cuando esta en proceso */}
        {isInProgress && (
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
      </div>

      {/* Acciones avanzadas — solo visible para administradores */}
      {documentStatus === "SIGNED" && canRetry && job && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer hover:text-slate-700">Acciones avanzadas</summary>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleCreateSubmissionJob()}
              disabled={requesting}
            >
              {requesting ? "Solicitando..." : "Reintentar envio"}
            </Button>
          </div>
        </details>
      )}

    </div>
  );
}
