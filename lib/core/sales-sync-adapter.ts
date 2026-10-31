import "@/lib/security/server-only";

import type { SalesAutoSyncFrequency } from "../../node_modules/.prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { calculateNextSalesSriSyncAt } from "@/lib/core/sales-auto-sync";

export type SalesSyncDocument = {
  accessKey: string;
  xmlContent: string;
  authorizationDate: Date;
};

export interface SalesAutoSyncProvider {
  id: string;
  configured: boolean;
  verifyConnection(): Promise<{ ok: boolean; message: string }>;
  syncIssuedDocuments(range: { from: Date; to: Date }): Promise<SalesSyncDocument[]>;
  downloadXml(accessKey: string): Promise<string>;
}

export class SriSalesSourceAdapter implements SalesAutoSyncProvider {
  id = "SRI_FACTURADOR";
  configured = false;

  constructor(private tenantId: string) {}

  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    const prisma = getPrismaClient();
    const credential = await prisma.purchaseSriCredential.findUnique({
      where: { tenantId: this.tenantId },
      select: { status: true },
    });
    if (!credential) return { ok: false, message: "No hay credenciales SRI configuradas." };
    if (credential.status === "VERIFIED") return { ok: true, message: "Conexión SRI verificada." };
    if (credential.status === "HUMAN_VERIFICATION_REQUIRED") return { ok: false, message: "Se requiere verificación manual en SRI." };
    if (credential.status === "INVALID") return { ok: false, message: "Credenciales SRI inválidas." };
    return { ok: false, message: `Estado de credencial: ${credential.status}` };
  }

  async syncIssuedDocuments(_range: { from: Date; to: Date }): Promise<SalesSyncDocument[]> {
    void _range;
    throw new Error("Descarga de comprobantes emitidos delegada al worker SRI de ventas.");
  }

  async downloadXml(_accessKey: string): Promise<string> {
    void _accessKey;
    throw new Error("Descarga de XML delegada al worker SRI de ventas.");
  }
}

export function getSalesSyncAdapter(tenantId: string): SalesAutoSyncProvider {
  return new SriSalesSourceAdapter(tenantId);
}

export async function getSalesAutoSyncConfig(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.salesAutoSyncSettings.findUnique({
    where: { tenantId },
  });
}

export async function upsertSalesAutoSyncConfig(
  tenantId: string,
  data: {
    enabled?: boolean;
    sriEnabled?: boolean;
    apiEnabled?: boolean;
    syncFrequency?: SalesAutoSyncFrequency;
  },
) {
  const prisma = getPrismaClient();

  const existing = await prisma.salesAutoSyncSettings.findUnique({
    where: { tenantId },
    select: { enabled: true, syncFrequency: true },
  });

  const willBeEnabled = data.enabled ?? existing?.enabled ?? false;
  const frequency = data.syncFrequency ?? existing?.syncFrequency ?? "DAILY";

  const update: Record<string, unknown> = { ...data };

  if (willBeEnabled && (data.enabled === true || data.syncFrequency !== undefined)) {
    update.nextSyncAt = calculateNextSalesSriSyncAt(frequency);
  }

  if (data.enabled === false) {
    update.nextSyncAt = null;
  }

  return prisma.salesAutoSyncSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ...data,
      nextSyncAt: willBeEnabled ? calculateNextSalesSriSyncAt(frequency) : null,
    },
    update,
  });
}

export async function getDueSyncTenants() {
  const prisma = getPrismaClient();
  const now = new Date();

  return prisma.salesAutoSyncSettings.findMany({
    where: {
      enabled: true,
      sriEnabled: true,
      nextSyncAt: { lte: now },
    },
    select: {
      tenantId: true,
      syncFrequency: true,
      lastSuccessAt: true,
    },
  });
}

export async function hasRunningSyncJob(tenantId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const running = await prisma.salesSriSyncJob.findFirst({
    where: {
      tenantId,
      OR: [{ status: "QUEUED" }, { status: "RUNNING", updatedAt: { gte: new Date(Date.now() - SALES_JOB_STALE_MS) } }],
    },
    select: { id: true },
  });
  return running !== null;
}

export async function createScheduledSyncJob(tenantId: string, frequency: SalesAutoSyncFrequency) {
  const result = await requestSalesSync(tenantId, { action: "manual_sync" });
  await getPrismaClient().salesAutoSyncSettings.update({ where: { tenantId }, data: { nextSyncAt: calculateNextSalesSriSyncAt(frequency) } });
  return result.job;
}

export const SALES_JOB_STALE_MS = 15 * 60 * 1000;

export function canResumeSalesJob(job: { type: string; status: string; dateFrom: Date | null; dateTo: Date | null; checkpointDate: Date | null; updatedAt: Date }, now = new Date()): boolean {
  if (job.type !== "SYNC_ISSUED_DOCUMENTS" || !job.dateTo) return false;
  if (job.checkpointDate && job.checkpointDate >= job.dateTo) return false;
  return ["FAILED", "PARTIAL", "HUMAN_VERIFICATION_REQUIRED"].includes(job.status) ||
    (job.status === "RUNNING" && now.getTime() - job.updatedAt.getTime() > SALES_JOB_STALE_MS);
}

export class SalesSyncRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// All sales producers (manual, resume, verification and scheduler) share this lock.
// No unique index is added that could fail on legacy queued rows in production.
export async function requestSalesSync(tenantId: string, options: {
  action: "manual_sync" | "resume_sync" | "historical_sync" | "verify_connection";
  jobId?: string; requestedByUserId?: string; dateFrom?: Date; dateTo?: Date;
}) {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sales-sri:${tenantId}`}, 0))`;
    const credential = await tx.purchaseSriCredential.findUnique({ where: { tenantId }, select: { id: true } });
    if (!credential) throw new SalesSyncRequestError("Guarda tus credenciales en Configuración SRI antes de sincronizar.");
    const now = new Date();
    let requested = options.jobId ? await tx.salesSriSyncJob.findFirst({ where: { id: options.jobId, tenantId } }) : null;
    if (options.jobId && !requested) throw new SalesSyncRequestError("Trabajo no encontrado.", 404);
    let active = await tx.salesSriSyncJob.findFirst({ where: { tenantId, status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { createdAt: "desc" } });
    if (active?.type === "VERIFY_CONNECTION" && active.status === "RUNNING" && now.getTime() - active.updatedAt.getTime() > SALES_JOB_STALE_MS) {
      await tx.salesSriSyncJob.update({ where: { id: active.id, tenantId }, data: { status: "FAILED", lockedAt: null, lockedBy: null, finishedAt: now, errorCode: "WORKER_INTERRUPTED", errorMessage: "La verificación se interrumpió. Las credenciales guardadas se conservan." } });
      active = null;
    }
    if (active && !canResumeSalesJob(active, now)) return { job: active, resumed: false, created: false };
    if (active) requested = active;
    const latestSuccess = await tx.salesSriSyncJob.findFirst({ where: { tenantId, type: "SYNC_ISSUED_DOCUMENTS", status: "SUCCEEDED" }, orderBy: { dateTo: "desc" } });
    if (!requested && options.action !== "verify_connection") {
      const candidates = await tx.salesSriSyncJob.findMany({ where: { tenantId, type: "SYNC_ISSUED_DOCUMENTS", status: { in: ["FAILED", "PARTIAL", "HUMAN_VERIFICATION_REQUIRED"] } }, orderBy: [{ checkpointDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 50 });
      requested = candidates.find((job) => canResumeSalesJob(job, now) && !(latestSuccess?.dateFrom && latestSuccess.dateTo && job.dateFrom && job.dateTo && latestSuccess.dateFrom <= job.dateFrom && latestSuccess.dateTo >= job.dateTo)) ?? null;
    }
    if (requested && options.action !== "verify_connection") {
      if (!canResumeSalesJob(requested, now)) throw new SalesSyncRequestError("Este trabajo no tiene días pendientes que puedan reanudarse.");
      const previousHistory = Array.isArray(requested.attemptHistory) ? requested.attemptHistory : [];
      const job = await tx.salesSriSyncJob.update({ where: { id: requested.id, tenantId }, data: {
        status: "QUEUED", lockedAt: null, lockedBy: null, finishedAt: null, durationMs: null,
        errorCode: null, errorMessage: null, maxAttempts: requested.attemptCount + 3,
        requestedByUserId: options.requestedByUserId ?? requested.requestedByUserId,
        attemptHistory: [...previousHistory, { event: "RESUMED", resumedAt: now.toISOString(), status: requested.status, errorCode: requested.errorCode, errorMessage: requested.errorMessage, checkpointDate: requested.checkpointDate?.toISOString() ?? null, previousCounts: { found: requested.documentsFound, imported: requested.documentsImported, duplicate: requested.documentsSkipped, rejected: requested.documentsRejected, failed: requested.documentsFailed } }],
      } });
      await tx.salesAutoSyncSettings.updateMany({ where: { tenantId }, data: { lastError: null } });
      return { job, resumed: true, created: false };
    }
    if (options.action === "resume_sync") throw new SalesSyncRequestError("No hay una sincronización pendiente que reanudar.");
    if (active) return { job: active, resumed: false, created: false };
    const config = await tx.salesAutoSyncSettings.findUnique({ where: { tenantId } });
    const lastSuccessAt = latestSuccess?.dateTo ?? config?.lastSuccessAt;
    const dateFrom = options.dateFrom ?? (lastSuccessAt
      ? new Date(lastSuccessAt.getTime() - 24 * 60 * 60 * 1000)
      : new Date(`${new Intl.DateTimeFormat("en", { timeZone: "America/Guayaquil", year: "numeric" }).format(now)}-01-01T00:00:00-05:00`));
    const job = await tx.salesSriSyncJob.create({ data: {
      tenantId, type: options.action === "verify_connection" ? "VERIFY_CONNECTION" : "SYNC_ISSUED_DOCUMENTS",
      requestedByUserId: options.requestedByUserId,
      dateFrom: options.action === "verify_connection" ? null : dateFrom,
      dateTo: options.action === "verify_connection" ? null : options.dateTo ?? now,
      maxAttempts: 3,
    } });
    await tx.salesAutoSyncSettings.upsert({ where: { tenantId }, create: { tenantId, sriEnabled: true }, update: { lastError: null, ...(options.action !== "verify_connection" ? { sriEnabled: true } : {}) } });
    return { job, resumed: false, created: true };
  });
}
