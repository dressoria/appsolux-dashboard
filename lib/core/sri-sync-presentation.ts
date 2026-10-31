export type SyncJobView = {
  id: string; type: string; status: string;
  dateFrom: string | null; dateTo: string | null; checkpointDate: string | null;
  totalDays: number | null; completedDays: number; currentDateLabel: string | null;
  documentsFound: number; documentsImported: number; documentsSkipped: number; documentsFailed: number;
  startedAt: string | null; finishedAt?: string | null;
  errorCode?: string | null; errorMessage?: string | null;
};

export function selectVisibleSyncJob(jobs: SyncJobView[]): SyncJobView | null {
  return jobs.find((job) => ["QUEUED", "RUNNING"].includes(job.status)) ?? jobs[0] ?? null;
}

export function syncPercentage(job: SyncJobView): number | null {
  return job.totalDays != null && job.totalDays > 0
    ? Math.max(0, Math.min(100, Math.round(job.completedDays / job.totalDays * 100))) : null;
}

export function connectionLabel(credentialStatus: string | null | undefined, job: SyncJobView | null, verifiedAt?: string | null): string {
  if (job && ["QUEUED", "RUNNING"].includes(job.status)) return job.type === "VERIFY_CONNECTION" ? "Verificando" : "Sincronizando";
  if (credentialStatus === "HUMAN_VERIFICATION_REQUIRED" || job?.status === "HUMAN_VERIFICATION_REQUIRED") return "Verificación humana requerida";
  if (credentialStatus === "INVALID" || ["INVALID_CREDENTIALS", "SRI_ACCOUNT_LOCKED", "SRI_SESSION_EXPIRED"].includes(job?.errorCode ?? "")) return "Error de autenticación";
  if (job && ["FAILED", "PARTIAL"].includes(job.status)) return job.type === "VERIFY_CONNECTION" ? "Error de autenticación" : "Error de consulta";
  if (credentialStatus === "ERROR") return "Error de autenticación";
  if (credentialStatus === "PENDING_VERIFICATION") return "Verificando";
  // A shared credential's status alone does not verify this particular connector.
  if (credentialStatus === "VERIFIED" && job?.status === "SUCCEEDED" && verifiedAt && job.finishedAt && job.finishedAt >= verifiedAt) return "Conectado y verificado";
  return credentialStatus ? "Configurado" : "Sin configurar";
}
