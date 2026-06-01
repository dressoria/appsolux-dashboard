import "@/lib/security/server-only";

import { Prisma, type SriSubmissionJobStatus } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";

export type { SriSubmissionJobStatus };

export type CreateSriSubmissionJobResult =
  | { ok: true; jobId: string; status: SriSubmissionJobStatus; alreadyExists: boolean }
  | {
      ok: false;
      code: "NOT_FOUND" | "WRONG_STATUS" | "NO_SIGNED_XML" | "DUPLICATE_ACTIVE" | "UNSUPPORTED_ENVIRONMENT";
      reason: string;
    };

export async function createSriSubmissionJobForDocument(params: {
  tenantId: string;
  documentId: string;
}): Promise<CreateSriSubmissionJobResult> {
  const prisma = getPrismaClient();

  const doc = await prisma.sriDocument.findFirst({
    where: { id: params.documentId, tenantId: params.tenantId },
    include: {
      signingJobs: {
        where: { status: "SUCCEEDED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!doc) {
    return {
      ok: false,
      code: "NOT_FOUND",
      reason: "Comprobante no encontrado o no pertenece a este tenant.",
    };
  }

  if (doc.status !== "SIGNED") {
    return {
      ok: false,
      code: "WRONG_STATUS",
      reason: "El documento aun no esta firmado. Primero completa la firma electronica.",
    };
  }

  if (doc.environment !== "TEST") {
    return {
      ok: false,
      code: "UNSUPPORTED_ENVIRONMENT",
      reason: "El envio a SRI produccion todavia no esta habilitado.",
    };
  }

  const latestSignedJob = doc.signingJobs[0] ?? null;
  if (!latestSignedJob?.signedXmlStorageKey) {
    return {
      ok: false,
      code: "NO_SIGNED_XML",
      reason: "No se encontro XML firmado para este documento.",
    };
  }

  const activeJob = await prisma.sriSubmissionJob.findFirst({
    where: {
      tenantId: params.tenantId,
      documentId: params.documentId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeJob) {
    return {
      ok: true,
      jobId: activeJob.id,
      status: activeJob.status,
      alreadyExists: true,
    };
  }

  const job = await prisma.sriSubmissionJob.create({
    data: {
      tenantId: params.tenantId,
      documentId: params.documentId,
      environment: "TEST",
      status: "QUEUED",
      sriAccessKey: doc.accessKey,
    },
  });

  return { ok: true, jobId: job.id, status: job.status, alreadyExists: false };
}

export async function getLatestSriSubmissionJobForDocument(tenantId: string, documentId: string) {
  const prisma = getPrismaClient();
  return prisma.sriSubmissionJob.findFirst({
    where: { tenantId, documentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSriSubmissionJobsForTenant(
  tenantId: string,
  filters?: { status?: SriSubmissionJobStatus; documentId?: string }
) {
  const prisma = getPrismaClient();
  return prisma.sriSubmissionJob.findMany({
    where: {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.documentId ? { documentId: filters.documentId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function claimNextSriSubmissionJob(workerId: string) {
  const prisma = getPrismaClient();
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.sriSubmissionJob.findFirst({
      where: {
        status: "QUEUED",
        OR: [{ runAfter: null }, { runAfter: { lte: now } }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    if (!job) return null;

    return tx.sriSubmissionJob.update({
      where: { id: job.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        lockedAt: now,
        lockedBy: workerId,
        startedAt: now,
        attempts: { increment: 1 },
      },
    });
  });

  return result;
}

export async function markSriSubmissionJobReceived(params: {
  jobId: string;
  receiptStatus: string;
  accessKey?: string | null;
  responseRaw?: Prisma.InputJsonValue;
}) {
  const prisma = getPrismaClient();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const job = await tx.sriSubmissionJob.update({
      where: { id: params.jobId },
      data: {
        status: "RECEIVED",
        receivedAt: now,
        sriReceiptStatus: params.receiptStatus,
        sriAccessKey: params.accessKey ?? undefined,
        sriResponseRaw: params.responseRaw,
        updatedAt: now,
      },
    });

    await tx.sriDocument.update({
      where: { id: job.documentId },
      data: { status: "SENT" },
    });

    return job;
  });
}

export async function markSriSubmissionJobAuthorized(params: {
  jobId: string;
  authorizationNumber: string;
  accessKey: string;
  authorizationStatus: string;
  authorizedAt?: Date;
  responseRaw?: Prisma.InputJsonValue;
}) {
  const prisma = getPrismaClient();
  const now = params.authorizedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const job = await tx.sriSubmissionJob.update({
      where: { id: params.jobId },
      data: {
        status: "AUTHORIZED",
        finishedAt: now,
        authorizedAt: now,
        lockedAt: null,
        lockedBy: null,
        sriAuthorizationNumber: params.authorizationNumber,
        sriAuthorizationStatus: params.authorizationStatus,
        sriAccessKey: params.accessKey,
        sriResponseRaw: params.responseRaw,
        updatedAt: now,
      },
    });

    await tx.sriDocument.update({
      where: { id: job.documentId },
      data: {
        status: "AUTHORIZED",
        accessKey: params.accessKey,
      },
    });

    return job;
  });
}

export async function markSriSubmissionJobRejected(params: {
  jobId: string;
  receiptStatus?: string | null;
  authorizationStatus?: string | null;
  accessKey?: string | null;
  errorMessage: string;
  responseRaw?: Prisma.InputJsonValue;
}) {
  const prisma = getPrismaClient();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const job = await tx.sriSubmissionJob.update({
      where: { id: params.jobId },
      data: {
        status: "REJECTED",
        finishedAt: now,
        lockedAt: null,
        lockedBy: null,
        sriReceiptStatus: params.receiptStatus ?? undefined,
        sriAuthorizationStatus: params.authorizationStatus ?? undefined,
        sriAccessKey: params.accessKey ?? undefined,
        errorMessage: params.errorMessage,
        sriResponseRaw: params.responseRaw,
        updatedAt: now,
      },
    });

    await tx.sriDocument.update({
      where: { id: job.documentId },
      data: { status: "REJECTED" },
    });

    return job;
  });
}

export async function markSriSubmissionJobFailed(params: {
  jobId: string;
  errorCode: string;
  errorMessage: string;
  responseRaw?: Prisma.InputJsonValue;
}) {
  const prisma = getPrismaClient();
  const current = await prisma.sriSubmissionJob.findUniqueOrThrow({
    where: { id: params.jobId },
  });
  const retryable = current.attempts < current.maxAttempts;

  return prisma.sriSubmissionJob.update({
    where: { id: params.jobId },
    data: {
      status: retryable ? "QUEUED" : "FAILED",
      lockedAt: null,
      lockedBy: null,
      finishedAt: retryable ? null : new Date(),
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      sriResponseRaw: params.responseRaw,
      runAfter: retryable ? new Date(Date.now() + 60_000 * current.attempts) : null,
    },
  });
}
