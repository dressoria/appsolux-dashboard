"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncProgressCard } from "@/components/appsolux/sri-tax/sync-progress-card";

type SyncJob = {
  id: string;
  type: string;
  status: string;
  dateFrom: string | null;
  dateTo: string | null;
  checkpointDate: string | null;
  totalDays: number | null;
  completedDays: number;
  currentDateLabel: string | null;
  attemptCount: number;
  maxAttempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  documentsFound: number;
  documentsImported: number;
  documentsSkipped: number;
  documentsFailed: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  QUEUED: { label: "En cola", className: "bg-slate-100 text-slate-700" },
  RUNNING: { label: "En progreso", className: "bg-blue-100 text-blue-700" },
  SUCCEEDED: { label: "Completado", className: "bg-emerald-100 text-emerald-700" },
  PARTIAL: { label: "Parcial", className: "bg-amber-100 text-amber-700" },
  FAILED: { label: "Fallido", className: "bg-red-100 text-red-700" },
  HUMAN_VERIFICATION_REQUIRED: { label: "Verificación requerida", className: "bg-yellow-100 text-yellow-700" },
};

const TYPE_LABELS: Record<string, string> = {
  VERIFY_CONNECTION: "Verificar conexión",
  SYNC_ISSUED_DOCUMENTS: "Sincronizar emitidos",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function SyncHistoryClient() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [triggeringSync, setTriggeringSync] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback((p: number, signal?: AbortSignal) => {
    return fetch(`/api/sales-import/sync-jobs?page=${p}&pageSize=20`, { cache: "no-store", signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo consultar el historial.");
        return data;
      }).then((data) => {
        if (signal?.aborted) return;
        setJobs(data.jobs); setTotalPages(data.totalPages); setTotal(data.total);
      }).catch((err: unknown) => {
        if (!signal?.aborted) setError(err instanceof Error ? err.message : "Error de conexión.");
      }).finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchJobs(page, controller.signal);
    return () => controller.abort();
  }, [page, fetchJobs]);

  const activeJob = jobs.find(
    (j) => j.status === "RUNNING" || j.status === "QUEUED",
  );
  const visibleJob = activeJob ?? jobs[0];
  const activeJobId = activeJob?.id;

  useEffect(() => {
    if (activeJobId && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchJobs(page);
      }, 5000);
    } else if (!activeJobId && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeJobId, page, fetchJobs]);

  async function triggerHistoricalSync() {
    setTriggeringSync(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/sales-import/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "historical_sync" }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Sincronización histórica iniciada (desde ${data.dateFrom?.slice(0, 10) ?? "2026-01-01"}).`);
        setPage(1);
        await fetchJobs(1);
      } else {
        setError(data.error ?? "Error al iniciar sincronización histórica.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setTriggeringSync(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historial de sincronización SRI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro de todos los trabajos de sincronización de comprobantes emitidos desde el SRI.
          </p>
        </div>
        <Button
          onClick={triggerHistoricalSync}
          disabled={triggeringSync}
          className="shrink-0"
        >
          {triggeringSync ? "Iniciando..." : "Sincronización histórica"}
        </Button>
      </div>

      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {visibleJob && <SyncProgressCard job={visibleJob} title="Último intento de sincronización de ventas" />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total trabajos</p>
            <p className="text-xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completados</p>
            <p className="text-xl font-bold text-emerald-600">
              {jobs.filter((j) => j.status === "SUCCEEDED").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Fallidos</p>
            <p className="text-xl font-bold text-red-600">
              {jobs.filter((j) => j.status === "FAILED").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">En progreso</p>
            <p className="text-xl font-bold text-blue-600">
              {jobs.filter((j) => j.status === "RUNNING" || j.status === "QUEUED").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trabajos de sincronización</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : jobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay trabajos de sincronización registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Período</th>
                    <th className="px-3 py-2">Encontrados</th>
                    <th className="px-3 py-2">Importados</th>
                    <th className="px-3 py-2">Omitidos</th>
                    <th className="px-3 py-2">Fallidos</th>
                    <th className="px-3 py-2">Duración</th>
                    <th className="px-3 py-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const badge = STATUS_BADGES[job.status] ?? { label: job.status, className: "bg-gray-100 text-gray-700" };
                    return (
                      <tr key={job.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-xs">
                          {TYPE_LABELS[job.type] ?? job.type}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {job.dateFrom && job.dateTo
                            ? `${new Date(job.dateFrom).toLocaleDateString("es-EC")} – ${new Date(job.dateTo).toLocaleDateString("es-EC")}`
                            : "—"}
                          {job.checkpointDate && (job.status === "RUNNING" || job.status === "PARTIAL") && (
                            <span className="block text-[10px] text-muted-foreground">
                              Progreso: {new Date(job.checkpointDate).toLocaleDateString("es-EC")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">{job.documentsFound}</td>
                        <td className="px-3 py-2 text-center text-emerald-600 font-medium">{job.documentsImported}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{job.documentsSkipped}</td>
                        <td className="px-3 py-2 text-center text-red-600">{job.documentsFailed}</td>
                        <td className="px-3 py-2 text-xs">{formatDuration(job.durationMs)}</td>
                        <td className="px-3 py-2 text-xs">{formatDate(job.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error details for failed jobs */}
      {jobs.some((j) => j.errorMessage) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalles de errores recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs
              .filter((j) => j.errorMessage)
              .slice(0, 5)
              .map((job) => (
                <div key={job.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{TYPE_LABELS[job.type] ?? job.type}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                  </div>
                  {job.errorCode && (
                    <p className="mt-1 text-xs font-mono text-red-600">{job.errorCode}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{job.errorMessage}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
