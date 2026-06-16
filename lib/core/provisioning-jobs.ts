import {
  Prisma,
  ProvisioningJobStatus,
  ProvisioningJobType,
} from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";

const DEFAULT_ERP_INSTANCE = "erp_cluster_01";

export type CreateProvisioningJobInput = {
  tenantId: string;
  requestedByUserId?: string | null;
  type: ProvisioningJobType;
  status?: ProvisioningJobStatus;
  priority?: number;
  maxAttempts?: number;
  payload?: Prisma.InputJsonValue;
};

export type CreateErpnextDedicatedSiteJobInput = {
  tenantId: string;
  requestedByUserId?: string | null;
  tenantSlug: string;
  tenantName: string;
  country?: string | null;
  currency?: string | null;
  erpInstanceName?: string | null;
};

export function sanitizeProvisioningSlug(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "tenant";
}

function getErpProvisioningDomain() {
  return process.env.ERP_PROVISIONING_DEFAULT_DOMAIN?.trim() || "";
}

export async function createProvisioningJob(input: CreateProvisioningJobInput) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.create({
    data: {
      tenantId: input.tenantId,
      requestedByUserId: input.requestedByUserId ?? null,
      type: input.type,
      status: input.status ?? ProvisioningJobStatus.queued,
      priority: input.priority ?? 100,
      maxAttempts: input.maxAttempts ?? 3,
      payload: input.payload ?? Prisma.JsonNull,
    },
  });
}

export async function getProvisioningJobById(jobId: string) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.findUnique({
    where: { id: jobId },
  });
}

export async function listProvisioningJobsForTenant(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.findMany({
    where: { tenantId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getLatestProvisioningJobForTenant(
  tenantId: string,
  type?: ProvisioningJobType
) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.findFirst({
    where: {
      tenantId,
      ...(type ? { type } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getActiveProvisioningJobForTenant(
  tenantId: string,
  type: ProvisioningJobType
) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.findFirst({
    where: {
      tenantId,
      type,
      status: {
        in: [ProvisioningJobStatus.queued, ProvisioningJobStatus.running],
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function createErpnextDedicatedSiteJobForTenant(
  input: CreateErpnextDedicatedSiteJobInput
) {
  const safeSlug = sanitizeProvisioningSlug(input.tenantSlug);
  const domain = getErpProvisioningDomain();
  const desiredSiteName = `${safeSlug}.${domain}`;

  return createProvisioningJob({
    tenantId: input.tenantId,
    requestedByUserId: input.requestedByUserId ?? null,
    type: ProvisioningJobType.erpnext_dedicated_site,
    status: ProvisioningJobStatus.queued,
    priority: 100,
    payload: {
      mode: "dedicated_site",
      tenantId: input.tenantId,
      tenantSlug: safeSlug,
      tenantName: input.tenantName,
      desiredSiteName,
      desiredCompanyName: input.tenantName,
      country: input.country || "Ecuador",
      currency: input.currency || "USD",
      apps: ["erpnext"],
      erpInstanceName: input.erpInstanceName || DEFAULT_ERP_INSTANCE,
    },
  });
}

export async function markProvisioningJobRunning(
  jobId: string,
  workerId: string
) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      status: ProvisioningJobStatus.running,
      lockedAt: new Date(),
      lockedBy: workerId,
      startedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  });
}

export async function markProvisioningJobSucceeded(
  jobId: string,
  result?: Prisma.InputJsonValue
) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      status: ProvisioningJobStatus.succeeded,
      result: result ?? Prisma.JsonNull,
      lockedAt: null,
      lockedBy: null,
      finishedAt: new Date(),
      lastError: null,
    },
  });
}

export async function markProvisioningJobFailed(
  jobId: string,
  errorMessage: string
) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      status: ProvisioningJobStatus.failed,
      lastError: errorMessage,
      lockedAt: null,
      lockedBy: null,
      finishedAt: new Date(),
    },
  });
}

export async function cancelProvisioningJob(jobId: string) {
  const prisma = getPrismaClient();

  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      status: ProvisioningJobStatus.canceled,
      lockedAt: null,
      lockedBy: null,
      finishedAt: new Date(),
    },
  });
}

export async function claimNextProvisioningJob(workerId: string) {
  const prisma = getPrismaClient();

  const nextJob = await prisma.provisioningJob.findFirst({
    where: {
      status: ProvisioningJobStatus.queued,
      attempts: {
        lt: prisma.provisioningJob.fields.maxAttempts,
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  if (!nextJob) {
    return null;
  }

  return prisma.provisioningJob.update({
    where: { id: nextJob.id },
    data: {
      status: ProvisioningJobStatus.running,
      attempts: { increment: 1 },
      lockedAt: new Date(),
      lockedBy: workerId,
      startedAt: new Date(),
      lastError: null,
    },
  });
}

export async function releaseProvisioningJob(jobId: string) {
  const prisma = getPrismaClient();

  const job = await prisma.provisioningJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return null;
  }

  if (
    job.status === ProvisioningJobStatus.succeeded ||
    job.status === ProvisioningJobStatus.failed ||
    job.status === ProvisioningJobStatus.canceled
  ) {
    return job;
  }

  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: {
      status: ProvisioningJobStatus.queued,
      lockedAt: null,
      lockedBy: null,
    },
  });
}