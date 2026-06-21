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

const JOB_STATUS_LABELS: Record<SubmissionJobStatus, string> = {
  QUEUED: "En cola",
  RUNNING: "Procesando",
  RECEIVED: "Recibido",
  AUTHORIZED: "Autorizado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
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

const JOB_STATUS_COLORS: Record<SubmissionJobStatus, string> = {
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
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFetchError(error instanceof Error ? error.message : "Error al cargar el envio SRI.");
        }
      });

    return () => {
      cancelled = true;
    };
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
        setRequestError(data.error ?? "No se pudo crear el envio al SRI.");
        return;
      }

      setRequestMessage(data.message ?? "Job de envio creado.");
      setJob(undefined);
      setFetchError(null);
      setRetryCount((count) => count + 1);
      router.refresh();
    } catch {
      setRequestError("Error de red. Intenta nuevamente.");
    } finally {
      setRequesting(false);
    }
  }

  if (documentStatus !== "SIGNED" && documentStatus !== "SENT" && documentStatus !== "AUTHORIZED" && documentStatus !== "REJECTED") {
    return (
      <p className="text-sm text-muted-foreground">
        Primero firma el XML para habilitar el envio al SRI.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando estado de envio SRI...</p>;
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
            setRetryCount((count) => count + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
        El comprobante se envia al SRI segun el ambiente configurado en el perfil del tenant. Una vez autorizado, el RIDE/PDF estara disponible para descarga.
      </div>

      {documentStatus === "REJECTED" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Este comprobante ya no debe reenviarse</p>
          <p className="mt-0.5 text-xs">
            Si el rechazo fue por recepcion SRI, la misma clave no debe reutilizarse. La correccion requiere un nuevo comprobante con nueva clave de acceso.
          </p>
        </div>
      )}

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
              {job.sriReceiptStatus && (
                <p className="text-xs text-muted-foreground">Recepcion SRI: {job.sriReceiptStatus}</p>
              )}
              {job.sriAuthorizationStatus && (
                <p className="text-xs text-muted-foreground">
                  Autorizacion SRI: {job.sriAuthorizationStatus}
                </p>
              )}
              {job.sriAuthorizationNumber && (
                <p className="font-mono text-xs text-muted-foreground break-all">
                  No. autorizacion: {job.sriAuthorizationNumber}
                </p>
              )}
              {job.sriAccessKey && (
                <p className="font-mono text-xs text-muted-foreground break-all">
                  Clave de acceso: {job.sriAccessKey}
                </p>
              )}
              {job.authorizedAt && (
                <p className="text-xs text-emerald-700">
                  Autorizado: {new Date(job.authorizedAt).toLocaleString("es-EC")}
                </p>
              )}
              {job.errorCode && (
                <p className="text-xs text-destructive font-mono">Codigo: {job.errorCode}</p>
              )}
              {job.errorMessage && (
                <p className="text-xs text-destructive">{job.errorMessage}</p>
              )}
              {job.status === "AUTHORIZED" && (
                <p className="text-xs text-emerald-700 font-medium">
                  Comprobante autorizado por el SRI. Usa los botones de descarga para obtener el XML autorizado y el RIDE/PDF.
                </p>
              )}
              {job.status === "REJECTED" && (
                <p className="text-xs text-red-700 font-medium">
                  Rechazado por SRI. No reenvíes este mismo comprobante; crea uno nuevo con nueva clave.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin envio registrado para este documento.</p>
      )}

      {requestMessage && <p className="text-sm text-emerald-700 font-medium">{requestMessage}</p>}
      {requestError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {requestError}
        </div>
      )}

      {documentStatus === "SIGNED" && (!job || job.status === "FAILED" || job.status === "REJECTED" || job.status === "CANCELLED") && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleCreateSubmissionJob()}
          disabled={requesting}
        >
          {requesting ? "Creando envio..." : "Enviar al SRI pruebas"}
        </Button>
      )}

      {(job?.status === "QUEUED" || job?.status === "RUNNING" || job?.status === "RECEIVED") && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setJob(undefined);
            setFetchError(null);
            setRetryCount((count) => count + 1);
          }}
        >
          Actualizar estado
        </Button>
      )}
    </div>
  );
}
