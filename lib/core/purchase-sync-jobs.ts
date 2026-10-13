import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type {
  PurchaseSriSyncJobType,
  PurchaseSriSyncTrigger,
} from "@prisma/client";

export async function createSyncJob(
  tenantId: string,
  type: PurchaseSriSyncJobType,
  options: {
    trigger?: PurchaseSriSyncTrigger;
    requestedByUserId?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
  } = {},
) {
  const prisma = getPrismaClient();

  const existing = await prisma.purchaseSriSyncJob.findFirst({
    where: {
      tenantId,
      type,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    return { job: existing, created: false };
  }

  const job = await prisma.purchaseSriSyncJob.create({
    data: {
      tenantId,
      type,
      trigger: options.trigger ?? "MANUAL",
      requestedByUserId: options.requestedByUserId ?? null,
      dateFrom: options.dateFrom ?? null,
      dateTo: options.dateTo ?? null,
    },
  });

  return { job, created: true };
}

export async function getActiveJob(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseSriSyncJob.findFirst({
    where: {
      tenantId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getJobById(tenantId: string, jobId: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseSriSyncJob.findFirst({
    where: { id: jobId, tenantId },
  });
}

export async function listJobs(
  tenantId: string,
  options: { page?: number; pageSize?: number } = {},
) {
  const prisma = getPrismaClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;

  const [items, total] = await Promise.all([
    prisma.purchaseSriSyncJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            documentsImported: true,
            documentsSkipped: true,
            errorCode: true,
          },
        },
      },
    }),
    prisma.purchaseSriSyncJob.count({ where: { tenantId } }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getSyncStatus(tenantId: string) {
  const prisma = getPrismaClient();
  const [credential, config, activeJob] = await Promise.all([
    prisma.purchaseSriCredential.findUnique({
      where: { tenantId },
      select: { status: true, verifiedAt: true },
    }),
    prisma.purchaseSriSyncConfig.findUnique({ where: { tenantId } }),
    getActiveJob(tenantId),
  ]);

  const lastSuccessJob = await prisma.purchaseSriSyncJob.findFirst({
    where: { tenantId, status: "SUCCEEDED" },
    orderBy: { finishedAt: "desc" },
    select: {
      documentsImported: true,
      documentsSkipped: true,
      documentsFound: true,
      finishedAt: true,
    },
  });

  return {
    configured: !!credential,
    credentialStatus: credential?.status ?? null,
    syncStatus: config?.status ?? "DISABLED",
    activeJob: activeJob
      ? { id: activeJob.id, type: activeJob.type, status: activeJob.status }
      : null,
    lastSyncAt: config?.lastSyncAt?.toISOString() ?? null,
    lastSuccessfulSyncAt: config?.lastSuccessfulSyncAt?.toISOString() ?? null,
    nextSyncAt: config?.nextSyncAt?.toISOString() ?? null,
    lastError: config?.lastError ?? null,
    lastResult: lastSuccessJob
      ? {
          documentsFound: lastSuccessJob.documentsFound,
          documentsImported: lastSuccessJob.documentsImported,
          documentsSkipped: lastSuccessJob.documentsSkipped,
          finishedAt: lastSuccessJob.finishedAt?.toISOString() ?? null,
        }
      : null,
  };
}
