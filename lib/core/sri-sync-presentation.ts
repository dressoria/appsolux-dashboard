export type SyncJobView = {
  id: string; type: string; status: string;
  dateFrom: string | null; dateTo: string | null; checkpointDate: string | null;
  totalDays: number | null; completedDays: number; currentDateLabel: string | null;
  documentsFound: number; documentsImported: number; documentsSkipped: number; documentsFailed: number;
  documentsRejected?: number;
  resumable?: boolean;
  updatedAt?: string;
  attemptHistory?: Array<{ event?: string; errorCode?: string | null; errorMessage?: string | null; finishedAt?: string; resumedAt?: string }>;
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

export function salesCredentialLabel(credential: { configured?: boolean; status?: string; verifiedAt?: string | null } | null): string {
  if (!credential?.configured) return "Sin configurar";
  if (credential.status === "INVALID") return "Credenciales inválidas";
  return "Credenciales configuradas";
}

export function salesSessionLabel(latestJob: SyncJobView | null): string {
  if (!latestJob) return "Se iniciará una sesión al sincronizar";
  if (latestJob.resumable && latestJob.status === "RUNNING") return "Sesión interrumpida; progreso guardado";
  if (["QUEUED", "RUNNING"].includes(latestJob.status)) return latestJob.type === "VERIFY_CONNECTION" ? "Verificando conexión" : "Sesión de sincronización en curso";
  if (latestJob.status === "SUCCEEDED") return "Última sesión completada";
  if (["FAILED", "PARTIAL", "HUMAN_VERIFICATION_REQUIRED"].includes(latestJob.status)) return "Sesión o consulta con dificultades";
  return "Sin sesión activa";
}

export function salesJobIssue(job: SyncJobView): string | null {
  if (!["FAILED", "PARTIAL", "HUMAN_VERIFICATION_REQUIRED"].includes(job.status)) return null;
  switch (job.errorCode) {
    case "INVALID_CREDENTIALS": return "El SRI rechazó el usuario o la contraseña. Revisa la configuración de acceso.";
    case "SRI_HUMAN_VERIFICATION_REQUIRED": return "El SRI solicita una verificación humana. El progreso se conserva.";
    case "SRI_QUERY_FAILED": return "No se pudo completar la consulta al SRI. El progreso se conserva para reintentar.";
    case "SRI_SESSION_EXPIRED": return "La sesión del SRI expiró. Al reanudar se abrirá una nueva con las credenciales guardadas.";
    case "SRI_PORTAL_CHANGED": return "La página del SRI no contiene los controles esperados por el conector. Revisa los detalles antes de reintentar.";
    case "INVALID_XML": return "Un XML no tiene la estructura esperada. No se importó y el día queda pendiente de revisión.";
    default: return "La sincronización se interrumpió por una dificultad técnica. Se conserva el último día completado.";
  }
}
