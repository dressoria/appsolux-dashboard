"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { syncPercentage, type SyncJobView } from "@/lib/core/sri-sync-presentation";
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
