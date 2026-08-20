import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import { createSriSigningJobForDocument } from "@/lib/core/sri-signing-jobs";
import { createSriSubmissionJobForDocument } from "@/lib/core/sri-submission-jobs";
import {
  createDraftSriDocumentFromBasicSale,
  getSriDocumentById,
  reserveSriDocumentNumberingForTesting,
} from "@/lib/core/sri";
import { getSriDocumentTechnicalChecklist } from "@/lib/core/sri-technical-checklist";

export type SaleSriFlowState =
  | "preparing"
  | "sending"
  | "received"
  | "authorized"
  | "rejected";

export type StartSriFlowFromBasicSaleResult = {
  documentId: string;
  alreadyExists: boolean;
  documentStatus: string;
  flowState: SaleSriFlowState;
  flowLabel: string;
  message: string;
  signingJobStatus: string | null;
  submissionJobStatus: string | null;
};

function mapFlowState(params: {
  documentStatus: string;
  submissionJobStatus: string | null;
}): Pick<StartSriFlowFromBasicSaleResult, "flowState" | "flowLabel"> {
  if (params.documentStatus === "AUTHORIZED") {
    return { flowState: "authorized", flowLabel: "Autorizado" };
  }

  if (params.documentStatus === "REJECTED") {
    return { flowState: "rejected", flowLabel: "Rechazado" };
  }

  if (
    params.documentStatus === "SENT" ||
    params.submissionJobStatus === "RECEIVED"
  ) {
    return { flowState: "received", flowLabel: "Recibido por SRI" };
  }

  if (
    params.submissionJobStatus === "QUEUED" ||
    params.submissionJobStatus === "RUNNING"
  ) {
    return { flowState: "sending", flowLabel: "Enviando" };
  }

  return { flowState: "preparing", flowLabel: "Preparando" };
}

export async function startSriFlowFromBasicSale(params: {
  tenantId: string;
  saleId: string;
  requestedByUserId?: string;
}): Promise<StartSriFlowFromBasicSaleResult> {
  await requireTenantOperationalAccess(params.tenantId);
  const prisma = getPrismaClient();

  const draft = await createDraftSriDocumentFromBasicSale({
    tenantId: params.tenantId,
    saleId: params.saleId,
  });

  const current = await getSriDocumentById(params.tenantId, draft.documentId);
  if (!current) {
    throw new Error("No se encontro el documento SRI asociado a la venta.");
  }

  if (current.status === "DRAFT") {
    const checklist = await getSriDocumentTechnicalChecklist(params.tenantId, current.id);
    if (!checklist) {
      throw new Error("No se pudo validar el checklist tecnico del comprobante.");
    }

    if (checklist.blockingIssues.length > 0) {
      throw new Error(
        `La factura SRI no puede prepararse todavia: ${checklist.blockingIssues.join("; ")}`
      );
    }

    await reserveSriDocumentNumberingForTesting({
      tenantId: params.tenantId,
      documentId: current.id,
    });

    await prisma.sriDocument.update({
      where: { id: current.id },
      data: { status: "READY_FOR_TESTING" },
    });
  }

  const afterReady = await prisma.sriDocument.findFirst({
    where: { id: draft.documentId, tenantId: params.tenantId },
    include: {
      signingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      submissionJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!afterReady) {
    throw new Error("No se pudo recargar el comprobante SRI despues de prepararlo.");
  }

  if (afterReady.status === "READY_FOR_TESTING") {
    const signing = await createSriSigningJobForDocument({
      tenantId: params.tenantId,
      documentId: afterReady.id,
      requestedByUserId: params.requestedByUserId,
    });

    if (!signing.ok) {
      throw new Error(signing.reason);
    }
  }

  const afterSigning = await prisma.sriDocument.findFirst({
    where: { id: draft.documentId, tenantId: params.tenantId },
    include: {
      signingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      submissionJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!afterSigning) {
    throw new Error("No se pudo consultar el estado actualizado del comprobante SRI.");
  }

  if (afterSigning.status === "SIGNED") {
    const submission = await createSriSubmissionJobForDocument({
      tenantId: params.tenantId,
      documentId: afterSigning.id,
    });

    if (!submission.ok && submission.code !== "WRONG_STATUS") {
      throw new Error(submission.reason);
    }
  }

  const finalDoc = await prisma.sriDocument.findFirst({
    where: { id: draft.documentId, tenantId: params.tenantId },
    include: {
      signingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      submissionJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!finalDoc) {
    throw new Error("No se pudo obtener el estado final del flujo SRI.");
  }

  const signingJob = finalDoc.signingJobs[0] ?? null;
  const submissionJob = finalDoc.submissionJobs[0] ?? null;
  const flow = mapFlowState({
    documentStatus: finalDoc.status,
    submissionJobStatus: submissionJob?.status ?? null,
  });

  const message =
    flow.flowState === "preparing"
      ? "La factura SRI quedo preparada y la firma electronica esta en proceso."
      : flow.flowState === "sending"
        ? "La factura SRI ya esta firmada y su envio fue puesto en cola."
        : flow.flowState === "received"
          ? "La factura fue recibida por SRI y continua su seguimiento."
          : flow.flowState === "authorized"
            ? "La factura SRI ya esta autorizada."
            : "La factura SRI fue rechazada y requiere revision.";

  return {
    documentId: finalDoc.id,
    alreadyExists: draft.alreadyExists,
    documentStatus: finalDoc.status,
    flowState: flow.flowState,
    flowLabel: flow.flowLabel,
    message,
    signingJobStatus: signingJob?.status ?? null,
    submissionJobStatus: submissionJob?.status ?? null,
  };
}
