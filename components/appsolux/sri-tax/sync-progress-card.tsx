"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { syncPercentage, salesJobIssue, type SyncJobView } from "@/lib/core/sri-sync-presentation";
export type SyncJobProgress = SyncJobView;

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Pendiente",
  RUNNING: "En progreso",
  SUCCEEDED: "Completado",
  PARTIAL: "Completado con observaciones",
  FAILED: "Error",
  HUMAN_VERIFICATION_REQUIRED: "Verificación humana requerida",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "text-slate-700",
  RUNNING: "text-blue-700",
  SUCCEEDED: "text-emerald-700",
  PARTIAL: "text-amber-700",
  FAILED: "text-red-700",
  HUMAN_VERIFICATION_REQUIRED: "text-orange-700",
};

export function SyncProgressCard({
  job,
  title,
}: {
  job: SyncJobProgress;
  title: string;
}) {
  const percentage = syncPercentage(job);

  const isActive = job.status === "RUNNING" || job.status === "QUEUED";

  return (
    <Card aria-live="polite" className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className={`text-sm font-medium ${STATUS_COLORS[job.status] ?? "text-muted-foreground"}`}>
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        {percentage !== null ? (
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <div role="progressbar" aria-label="Progreso de sincronización" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined} className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isActive ? "bg-blue-500 animate-pulse" : job.status === "SUCCEEDED" ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {job.completedDays} de {job.totalDays} días revisados
            </p>
          </div>
        ) : isActive ? (
          <div>
            <div role="progressbar" aria-label="Progreso de sincronización" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined} className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Calculando progreso...
            </p>
          </div>
        ) : null}

        {job.finishedAt && <p className="text-sm text-muted-foreground">Finalizado: {new Date(job.finishedAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p>}
        {job.errorMessage && <p role="alert" className="text-sm text-red-700">{job.errorCode ? `${job.errorCode}: ` : ""}{job.errorMessage}</p>}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Encontrados</p>
            <p className="text-lg font-bold">{job.documentsFound}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Importados</p>
            <p className="text-lg font-bold text-emerald-600">{job.documentsImported}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duplicados</p>
            <p className="text-lg font-bold text-muted-foreground">{job.documentsSkipped}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Errores</p>
            <p className="text-lg font-bold text-red-600">{job.documentsFailed}</p>
          </div>
        </div>

        {/* Period & current date */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {job.dateFrom && job.dateTo && (
            <div>
              <span className="text-muted-foreground">Período: </span>
              <span>
                {new Date(job.dateFrom).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}
                {" – "}
                {new Date(job.dateTo).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}
              </span>
            </div>
          )}
          {job.currentDateLabel && (
            <div>
              <span className="text-muted-foreground">Procesando: </span>
              <span className="font-medium">{job.currentDateLabel}</span>
            </div>
          )}
          {job.checkpointDate && (
            <div>
              <span className="text-muted-foreground">Último día completado: </span>
              <span>{new Date(job.checkpointDate).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}</span>
            </div>
          )}
          {job.startedAt && (
            <div>
              <span className="text-muted-foreground">Iniciado: </span>
              <span>{new Date(job.startedAt).toLocaleString("es-EC")}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Sales-specific presentation leaves the existing purchase card unchanged.
export function SalesSyncProgressCard({ job, compact = false }: { job: SyncJobProgress; compact?: boolean }) {
  const percentage = syncPercentage(job);
  const active = ["QUEUED", "RUNNING"].includes(job.status) && !job.resumable;
  const statusLabel = job.status === "RUNNING" && job.resumable ? "Interrumpido" : STATUS_LABELS[job.status] ?? job.status;
  return <Card className="overflow-hidden border-slate-200 shadow-sm">
    <CardHeader className="gap-3 border-b border-slate-100 bg-slate-50/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle className="text-base font-semibold text-slate-950">{active ? "Sincronización de ventas en progreso" : job.resumable ? "Sincronización pendiente de reanudar" : "Último resultado de sincronización"}</CardTitle>
        <p className="mt-1 text-xs text-slate-500">{active ? "El progreso se guarda automáticamente. Puedes salir y volver a esta pantalla." : job.resumable ? "El período y el último checkpoint se conservan para reanudar." : "Resultado guardado del último trabajo de ventas."}</p>
      </div>
      <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${job.status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-700" : active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{statusLabel}{percentage !== null ? ` · ${percentage}%` : ""}</span>
    </CardHeader>
    <CardContent className="space-y-4 pt-5">
      {(!compact || active) && <div>
        <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{job.totalDays ? `${job.completedDays} de ${job.totalDays} días procesados` : "Calculando progreso…"}</span>{percentage !== null && <span className="font-semibold text-[#1E52F1]">{percentage}%</span>}</div>
        <div role="progressbar" aria-label="Progreso de ventas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-[#1E52F1] transition-all ${percentage === null ? "w-1/3 animate-pulse" : ""}`} style={percentage === null ? undefined : { width: `${percentage}%` }} /></div>
      </div>}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Encontrados", job.documentsFound, "text-slate-900"],
          ["Importados", job.documentsImported, "text-emerald-700"],
          ["Duplicados", job.documentsSkipped, "text-slate-600"],
          ["Rechazados / omitidos", job.documentsRejected ?? 0, "text-amber-700"],
          ["Errores técnicos", job.documentsFailed, "text-red-700"],
        ].map(([label, count, color]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{count}</dd></div>)}
      </dl>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
        {job.currentDateLabel && <p>{active ? "Procesando" : "Último día consultado"}: <span className="font-medium text-slate-700">{job.currentDateLabel}</span></p>}
        {job.checkpointDate && <p>Último checkpoint: <span className="font-medium text-slate-700">{new Date(job.checkpointDate).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}</span></p>}
        {job.finishedAt && <p>Finalizado: {new Date(job.finishedAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p>}
        {compact && job.totalDays && <p>{job.completedDays} de {job.totalDays} días procesados</p>}
      </div>
      {salesJobIssue(job) && <p className="text-sm text-slate-600">{salesJobIssue(job)}</p>}
      {(job.errorMessage || job.attemptHistory?.length) ? <details className="rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium">Ver detalles</summary>
        {job.errorMessage && <p className="mt-3 break-words"><span className="font-mono">{job.errorCode}</span>{" · "}{job.errorMessage}</p>}
        {job.attemptHistory?.map((attempt, index) => <p key={index} className="mt-2 break-words">{attempt.resumedAt ?? attempt.finishedAt} · {attempt.event}{attempt.errorCode ? ` · ${attempt.errorCode}` : ""}{attempt.errorMessage ? ` · ${attempt.errorMessage}` : ""}</p>)}
      </details> : null}
    </CardContent>
  </Card>;
}
