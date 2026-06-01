import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { runSriTechnicalChecklist } from "./sri-technical-checklist";
import type { SriSigningJobStatus } from "@prisma/client";

export type { SriSigningJobStatus };

export type SriSigningJob = {
  id: string;
  tenantId: string;
  documentId: string;
  status: SriSigningJobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  lockedAt: Date | null;
  lockedBy: string | null;
  runAfter: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  unsignedXmlHash: string | null;
  signedXmlStorageKey: string | null;
  signedXmlHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSriSigningJobResult =
  | { ok: true; job: SriSigningJob; alreadyExists: boolean }
  | { ok: false; reason: string; code: "NOT_FOUND" | "WRONG_STATUS" | "BLOCKED" | "NO_SIGNATURE_CONFIG" | "DUPLICATE_ACTIVE" };

export async function createSriSigningJobForDocument(params: {
  tenantId: string;
  documentId: string;
  requestedByUserId?: string;
}): Promise<CreateSriSigningJobResult> {
  const prisma = getPrismaClient();

  // Load document — validate it belongs to tenant
  const doc = await prisma.sriDocument.findFirst({
    where: { id: params.documentId, tenantId: params.tenantId },
    include: {
      establishment: true,
      issuePoint: true,
      lines: true,
    },
  });

  if (!doc) {
    return { ok: false, reason: "Comprobante no encontrado o no pertenece a este tenant.", code: "NOT_FOUND" };
  }

  if (doc.status !== "READY_FOR_TESTING") {
    return {
      ok: false,
      reason: "El comprobante debe estar en estado 'Listo para pruebas' para solicitar firma.",
      code: "WRONG_STATUS",
    };
  }

  // Validate signature config exists and has minimum metadata
  const sigConfig = await prisma.sriSignatureConfig.findUnique({
    where: { tenantId: params.tenantId },
    select: { id: true, certificateFileName: true, expiresAt: true, status: true },
  });

  if (!sigConfig || !sigConfig.certificateFileName) {
    return {
      ok: false,
      reason: "Configura la firma electrónica antes de solicitar firma. Ve a SRI → Firma electrónica.",
      code: "NO_SIGNATURE_CONFIG",
    };
  }

  // Check no active job already exists (QUEUED or RUNNING)
  const activeJob = await prisma.sriSigningJob.findFirst({
    where: {
      documentId: params.documentId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeJob) {
    return {
      ok: true,
      job: activeJob,
      alreadyExists: true,
    };
  }

  // Run technical checklist to confirm no blocking issues
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId: params.tenantId },
  });

  const sequence = doc.sequenceId
    ? await prisma.sriDocumentSequence.findUnique({ where: { id: doc.sequenceId } })
    : null;

  const checklist = runSriTechnicalChecklist({
    documentId: params.documentId,
    document: {
      documentType: doc.documentType,
      status: doc.status,
      sequentialNumber: doc.sequentialNumber,
      customerName: doc.customerName,
      customerIdentification: doc.customerIdentification ?? null,
      customerEmail: doc.customerEmail ?? null,
      grandTotal: Number(doc.grandTotal),
      issuedAt: doc.issuedAt,
      createdAt: doc.createdAt,
    },
    lines: doc.lines.map((l) => ({
      itemName: l.itemName,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    })),
    establishment: {
      code: doc.establishment.code,
      name: doc.establishment.name,
    },
    issuePoint: {
      code: doc.issuePoint.code,
    },
    profile: profile
      ? {
          ruc: profile.ruc,
          legalName: profile.legalName,
          environment: profile.environment,
        }
      : null,
    sequence: sequence
      ? {
          isActive: sequence.isActive,
          currentNumber: sequence.currentNumber,
        }
      : null,
  });

  if (checklist.blockingIssues.length > 0) {
    return {
      ok: false,
      reason: `El checklist técnico tiene problemas bloqueantes: ${checklist.blockingIssues.join("; ")}`,
      code: "BLOCKED",
    };
  }

  // Create job
  const job = await prisma.sriSigningJob.create({
    data: {
      tenantId: params.tenantId,
      documentId: params.documentId,
      status: "QUEUED",
    },
  });

  return { ok: true, job, alreadyExists: false };
}

export async function getLatestSriSigningJobForDocument(
  tenantId: string,
  documentId: string
): Promise<SriSigningJob | null> {
  const prisma = getPrismaClient();
  return prisma.sriSigningJob.findFirst({
    where: { tenantId, documentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSriSigningJobsForTenant(
  tenantId: string,
  filters?: { status?: SriSigningJobStatus; documentId?: string }
): Promise<SriSigningJob[]> {
  const prisma = getPrismaClient();
  return prisma.sriSigningJob.findMany({
    where: {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.documentId ? { documentId: filters.documentId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export type ClaimJobResult =
  | { claimed: true; job: SriSigningJob }
  | { claimed: false };

/**
 * Reclaims next available job for a worker.
 * Uses a transaction to minimize (but not fully eliminate) race conditions.
 * Workers should handle duplicate claims defensively.
 */
export async function claimNextSriSigningJob(workerId: string): Promise<ClaimJobResult> {
  const prisma = getPrismaClient();
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.sriSigningJob.findFirst({
      where: {
        status: "QUEUED",
        OR: [{ runAfter: null }, { runAfter: { lte: now } }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    if (!job) return null;

    return tx.sriSigningJob.update({
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

  if (!result) return { claimed: false };
  return { claimed: true, job: result };
}

/**
 * Marks a job as SUCCEEDED.
 * Does NOT change SriDocument.status to SIGNED — that requires real XAdES signature verification.
 */
export async function markSriSigningJobSucceeded(
  jobId: string,
  params: {
    signedXmlStorageKey: string;
    signedXmlHash: string;
  }
): Promise<SriSigningJob> {
  const prisma = getPrismaClient();
  return prisma.sriSigningJob.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      signedXmlStorageKey: params.signedXmlStorageKey,
      signedXmlHash: params.signedXmlHash,
    },
  });
}

export async function markSriSigningJobFailed(
  jobId: string,
  params: {
    errorCode: string;
    errorMessage: string;
  }
): Promise<SriSigningJob> {
  const prisma = getPrismaClient();

  const job = await prisma.sriSigningJob.findUniqueOrThrow({ where: { id: jobId } });
  const retryable = job.attempts < job.maxAttempts;

  return prisma.sriSigningJob.update({
    where: { id: jobId },
    data: {
      status: retryable ? "QUEUED" : "FAILED",
      lockedAt: null,
      lockedBy: null,
      finishedAt: retryable ? null : new Date(),
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      runAfter: retryable ? new Date(Date.now() + 60_000 * job.attempts) : null,
    },
  });
}
