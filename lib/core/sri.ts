import "@/lib/security/server-only";
import { Prisma, SriDocumentType } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { getLimit } from "@/lib/core/plans";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import { validateCustomerForSriInvoice } from "@/lib/core/customer-fiscal";
import { isValidEcuadorRuc } from "@/lib/core/ecuador-tax-id";
import { buildSriAccessKey, createStableNumericCode } from "./sri-access-key";
import { getSriSignatureReadiness } from "./sri-signature-readiness";

export type SriModuleStatus = {
  hasProfile: boolean;
  profileStatus: "PENDING" | "CONFIGURED" | "DISABLED" | null;
  environment: "TEST" | "PRODUCTION" | null;
  ruc: string | null;
  legalName: string | null;
  establishmentCount: number;
  issuePointCount: number;
  sequenceCount: number;
  signatureStatus: "NOT_UPLOADED" | "UPLOADED_METADATA_ONLY" | "READY_FOR_TESTING" | "EXPIRED" | null;
  signatureHasEncryptedCertificate: boolean;
  signatureHasEncryptedPassword: boolean;
  readinessLabel: "not_started" | "incomplete" | "ready_for_testing" | "production_ready";
  documentCount: number;
  documentStatusCounts: {
    draft: number;
    readyForTesting: number;
    signed: number;
  };
};

export async function getSriModuleStatus(tenantId: string): Promise<SriModuleStatus> {
  const prisma = getPrismaClient();

  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId },
    include: {
      establishments: { where: { isActive: true }, select: { id: true } },
      signatureConfig: {
        select: {
          status: true,
          encryptedCertificateStorageKey: true,
          encryptedCertificatePassword: true,
          encryptionKeyVersion: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!profile) {
    return {
      hasProfile: false,
      profileStatus: null,
      environment: null,
      ruc: null,
      legalName: null,
      establishmentCount: 0,
      issuePointCount: 0,
      sequenceCount: 0,
      signatureStatus: null,
      signatureHasEncryptedCertificate: false,
      signatureHasEncryptedPassword: false,
      readinessLabel: "not_started",
      documentCount: 0,
      documentStatusCounts: {
        draft: 0,
        readyForTesting: 0,
        signed: 0,
      },
    };
  }

  const [issuePointCount, sequenceCount, documentCount, draftCount, readyForTestingCount, signedCount] = await Promise.all([
    prisma.sriIssuePoint.count({ where: { tenantId, isActive: true } }),
    prisma.sriDocumentSequence.count({ where: { tenantId, isActive: true } }),
    prisma.sriDocument.count({ where: { tenantId } }),
    prisma.sriDocument.count({ where: { tenantId, status: "DRAFT" } }),
    prisma.sriDocument.count({ where: { tenantId, status: "READY_FOR_TESTING" } }),
    prisma.sriDocument.count({ where: { tenantId, status: "SIGNED" } }),
  ]);

  const establishmentCount = profile.establishments.length;
  const signatureStatus = profile.signatureConfig?.status ?? null;
  const signatureHasEncryptedCertificate = Boolean(
    profile.signatureConfig?.encryptedCertificateStorageKey
  );
  const signatureHasEncryptedPassword = Boolean(
    profile.signatureConfig?.encryptedCertificatePassword
  );
  const signatureReadiness = getSriSignatureReadiness(profile.signatureConfig);

  let readinessLabel: SriModuleStatus["readinessLabel"] = "incomplete";
  if (profile.status === "CONFIGURED" && establishmentCount > 0 && issuePointCount > 0 && sequenceCount > 0) {
    readinessLabel =
      signatureReadiness.isReady
        ? profile.environment === "PRODUCTION"
          ? "production_ready"
          : "ready_for_testing"
        : "incomplete";
  } else if (profile.status === "PENDING" && establishmentCount === 0) {
    readinessLabel = "incomplete";
  }

  return {
    hasProfile: true,
    profileStatus: profile.status,
    environment: profile.environment,
    ruc: profile.ruc,
    legalName: profile.legalName,
    establishmentCount,
    issuePointCount,
    sequenceCount,
    signatureStatus,
    signatureHasEncryptedCertificate,
    signatureHasEncryptedPassword,
    readinessLabel,
    documentCount,
    documentStatusCounts: {
      draft: draftCount,
      readyForTesting: readyForTestingCount,
      signed: signedCount,
    },
  };
}

export async function getSriProfile(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.sriTaxpayerProfile.findUnique({ where: { tenantId } });
}

export async function upsertSriProfile(
  tenantId: string,
  data: {
    legalName: string;
    tradeName?: string | null;
    ruc: string;
    dirMatriz?: string | null;
    contribuyenteRimpe?: string | null;
    accountingRequired: boolean;
    specialTaxpayerNumber?: string | null;
    withholdingAgentResolution?: string | null;
    environment: "TEST" | "PRODUCTION";
  }
) {
  const prisma = getPrismaClient();
  return prisma.sriTaxpayerProfile.upsert({
    where: { tenantId },
    create: { tenantId, ...data, status: "CONFIGURED" },
    update: { ...data, status: "CONFIGURED" },
  });
}

export async function listSriEstablishments(tenantId: string) {
  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId },
    select: { id: true },
  });
  if (!profile) return [];
  return prisma.sriEstablishment.findMany({
    where: { tenantId },
    orderBy: { code: "asc" },
  });
}

export async function createSriEstablishment(
  tenantId: string,
  profileId: string,
  data: { code: string; name: string; address: string; isMain: boolean }
) {
  const prisma = getPrismaClient();
  return prisma.sriEstablishment.create({
    data: { tenantId, profileId, ...data },
  });
}

export async function listSriIssuePoints(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.sriIssuePoint.findMany({
    where: { tenantId },
    include: { establishment: { select: { code: true, name: true } } },
    orderBy: [{ establishment: { code: "asc" } }, { code: "asc" }],
  });
}

export async function createSriIssuePoint(
  tenantId: string,
  data: { establishmentId: string; code: string; name: string }
) {
  const prisma = getPrismaClient();
  await requireTenantOperationalAccess(tenantId);
  const limit = await getLimit(tenantId, "issuePoints");
  return prisma.$transaction(async (tx) => {
    const currentCount = await tx.sriIssuePoint.count({ where: { tenantId } });
    if (currentCount >= limit) {
      throw new Error(`Alcanzaste el límite de ${limit} puntos de emisión de tu plan.`);
    }
    return tx.sriIssuePoint.create({ data: { tenantId, ...data } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listSriSequences(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.sriDocumentSequence.findMany({
    where: { tenantId },
    include: {
      establishment: { select: { code: true, name: true } },
      issuePoint: { select: { code: true, name: true } },
    },
    orderBy: [{ establishment: { code: "asc" } }, { issuePoint: { code: "asc" } }, { documentType: "asc" }],
  });
}

export async function upsertSriSequence(
  tenantId: string,
  data: {
    establishmentId: string;
    issuePointId: string;
    documentType: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE" | "WITHHOLDING" | "REFERRAL_GUIDE";
    currentNumber: number;
    startNumber: number;
    maxNumber?: number | null;
  }
) {
  const prisma = getPrismaClient();
  return prisma.sriDocumentSequence.upsert({
    where: {
      tenantId_establishmentId_issuePointId_documentType: {
        tenantId,
        establishmentId: data.establishmentId,
        issuePointId: data.issuePointId,
        documentType: data.documentType,
      },
    },
    create: { tenantId, ...data },
    update: { currentNumber: data.currentNumber, startNumber: data.startNumber, maxNumber: data.maxNumber },
  });
}

export async function getSriSignatureConfig(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.sriSignatureConfig.findUnique({ where: { tenantId } });
}

export async function updateSriSignatureMetadata(
  tenantId: string,
  data: {
    certificateFileName: string;
    expiresAt: Date;
    issuerName?: string | null;
    subjectName?: string | null;
    serialNumber?: string | null;
    fingerprintSha256?: string | null;
  }
) {
  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId },
    select: { id: true },
  });
  if (!profile) throw new Error("Perfil SRI no configurado. Configura el RUC y razón social primero.");

  const current = await prisma.sriSignatureConfig.findUnique({ where: { tenantId } });
  const readiness = getSriSignatureReadiness(current ? { ...current, expiresAt: data.expiresAt } : null);
  return prisma.sriSignatureConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      profileId: profile.id,
      status: readiness.isReady ? "READY_FOR_TESTING" : data.expiresAt < new Date() ? "EXPIRED" : "UPLOADED_METADATA_ONLY",
      certificateUploadedAt: new Date(),
      ...data,
    },
    update: {
      status: readiness.isReady ? "READY_FOR_TESTING" : data.expiresAt < new Date() ? "EXPIRED" : "UPLOADED_METADATA_ONLY",
      certificateUploadedAt: new Date(),
      ...data,
    },
  });
}

export async function updateSriSignatureSecureMaterial(
  tenantId: string,
  data: {
    certificateFileName: string;
    encryptedCertificateStorageKey: string;
    encryptedCertificatePassword: string;
    encryptionKeyVersion: string;
  }
) {
  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId },
    select: { id: true },
  });

  if (!profile) {
    throw new Error("Perfil SRI no configurado. Configura el RUC y razon social primero.");
  }

  const current = await prisma.sriSignatureConfig.findUnique({
    where: { tenantId },
    select: { expiresAt: true },
  });

  const nextStatus =
    current?.expiresAt == null
      ? "UPLOADED_METADATA_ONLY"
      : current.expiresAt < new Date()
        ? "EXPIRED"
        : "READY_FOR_TESTING";

  return prisma.sriSignatureConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      profileId: profile.id,
      status: nextStatus,
      certificateFileName: data.certificateFileName,
      certificateUploadedAt: new Date(),
      encryptedCertificateStorageKey: data.encryptedCertificateStorageKey,
      encryptedCertificatePassword: data.encryptedCertificatePassword,
      encryptionKeyVersion: data.encryptionKeyVersion,
    },
    update: {
      status: nextStatus,
      certificateFileName: data.certificateFileName,
      certificateUploadedAt: new Date(),
      encryptedCertificateStorageKey: data.encryptedCertificateStorageKey,
      encryptedCertificatePassword: data.encryptedCertificatePassword,
      encryptionKeyVersion: data.encryptionKeyVersion,
    },
  });
}

export function validateRuc(ruc: string): boolean {
  return isValidEcuadorRuc(ruc);
}

export function validateThreeDigitCode(code: string): boolean {
  return /^\d{3}$/.test(code.trim());
}

export function formatSequentialNumber(n: number): string {
  return String(n).padStart(9, "0");
}

export const SRI_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de credito",
  DEBIT_NOTE: "Nota de debito",
  WITHHOLDING: "Retencion",
  REFERRAL_GUIDE: "Guia de remision",
};

export const SRI_DOCUMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  READY_FOR_TESTING: "Listo para pruebas",
  VALIDATION_ERROR: "Error de validacion",
  SIGNED: "Firmado",
  SENT: "Recibido por SRI",
  AUTHORIZED: "Autorizado por SRI",
  REJECTED: "Rechazado por SRI",
  CANCELLED: "Anulado",
};

export const SRI_DOCUMENT_SOURCE_LABELS: Record<string, string> = {
  BASIC_SALE: "Venta basica (POS)",
  ERP_SALES_INVOICE: "Venta ERP",
  MANUAL: "Manual",
};

export async function getSriDocuments(
  tenantId: string,
  options: { take?: number; status?: string } = {}
) {
  const prisma = getPrismaClient();
  return prisma.sriDocument.findMany({
    where: {
      tenantId,
      ...(options.status ? { status: options.status as never } : {}),
    },
    include: {
      establishment: { select: { code: true, name: true } },
      issuePoint: { select: { code: true, name: true } },
      lines: { select: { id: true } },
      signingJobs: {
        select: { id: true, status: true, createdAt: true, finishedAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 50,
  });
}

export async function getSriDocumentById(tenantId: string, documentId: string) {
  const prisma = getPrismaClient();
  return prisma.sriDocument.findFirst({
    where: { id: documentId, tenantId },
    include: {
      establishment: true,
      issuePoint: true,
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getSriDocumentSequence(
  tenantId: string,
  establishmentId: string,
  issuePointId: string,
  documentType: SriDocumentType = SriDocumentType.INVOICE
) {
  const prisma = getPrismaClient();
  return prisma.sriDocumentSequence.findFirst({
    where: { tenantId, establishmentId, issuePointId, documentType, isActive: true },
  });
}

export async function getSriDraftForSale(tenantId: string, saleId: string) {
  const prisma = getPrismaClient();
  return prisma.sriDocument.findFirst({
    where: { tenantId, sourceType: "BASIC_SALE", sourceId: saleId },
    select: {
      id: true,
      status: true,
      accessKey: true,
      environment: true,
      submissionJobs: {
        where: { status: "AUTHORIZED" },
        select: { sriAuthorizationNumber: true, authorizedAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function getSriDocumentsForSales(
  tenantId: string,
  saleIds: string[]
): Promise<Record<string, { id: string; status: string; environment: string; sriAuthorizationNumber: string | null }>> {
  if (saleIds.length === 0) return {};
  const prisma = getPrismaClient();
  const docs = await prisma.sriDocument.findMany({
    where: { tenantId, sourceType: "BASIC_SALE", sourceId: { in: saleIds } },
    select: {
      id: true,
      sourceId: true,
      status: true,
      environment: true,
      submissionJobs: {
        where: { status: "AUTHORIZED" },
        select: { sriAuthorizationNumber: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return Object.fromEntries(
    docs
      .filter((d) => d.sourceId)
      .map((d) => [
        d.sourceId!,
        {
          id: d.id,
          status: d.status,
          environment: d.environment,
          sriAuthorizationNumber: d.submissionJobs[0]?.sriAuthorizationNumber ?? null,
        },
      ])
  );
}

export async function createDraftSriDocumentFromBasicSale({
  tenantId,
  saleId,
}: {
  tenantId: string;
  saleId: string;
}): Promise<{ documentId: string; alreadyExists: boolean }> {
  await requireTenantOperationalAccess(tenantId);
  const prisma = getPrismaClient();

  const existing = await prisma.sriDocument.findFirst({
    where: { tenantId, sourceType: "BASIC_SALE", sourceId: saleId },
    select: { id: true },
  });
  if (existing) {
    return { documentId: existing.id, alreadyExists: true };
  }

  const sale = await prisma.lightweightSale.findFirst({
    where: { id: saleId, tenantId },
    include: {
      customer: { select: { name: true, email: true, phone: true, identificationType: true, identification: true } },
      items: { include: { product: { select: { name: true, barcode: true } } } },
    },
  });
  if (!sale) throw new Error("Venta no encontrada.");
  if (sale.status === "canceled") throw new Error("La venta esta cancelada y no puede prepararse como comprobante.");
  const fiscalCustomer = validateCustomerForSriInvoice(sale.customer);

  const profile = await prisma.sriTaxpayerProfile.findUnique({ where: { tenantId } });
  if (!profile) throw new Error("No existe configuracion SRI. Configura la empresa y RUC primero.");

  const establishment = await prisma.sriEstablishment.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isMain: "desc" }, { code: "asc" }],
  });
  if (!establishment) throw new Error("No hay establecimientos activos. Configura al menos uno en SRI.");

  const issuePoint = await prisma.sriIssuePoint.findFirst({
    where: { tenantId, establishmentId: establishment.id, isActive: true },
    orderBy: { code: "asc" },
  });
  if (!issuePoint) throw new Error("No hay puntos de emision activos para el establecimiento.");

  const sequence = await prisma.sriDocumentSequence.findFirst({
    where: {
      tenantId,
      establishmentId: establishment.id,
      issuePointId: issuePoint.id,
      documentType: "INVOICE",
      isActive: true,
    },
  });
  if (!sequence) throw new Error("No hay secuencia de factura configurada para este establecimiento y punto de emision. Crea una en SRI → Secuenciales.");

  const lines = sale.items.map((item) => {
    const qty = item.quantity;
    const unitPrice = Number(item.price);
    const discountAmount = Number(item.discountAmount ?? 0);
    const lineSubtotal = qty * unitPrice - discountAmount;
    const taxRate = Number(item.taxRate ?? 0);
    const taxAmount = Math.round(lineSubtotal * taxRate) / 100;
    return {
      itemName: item.product.name,
      itemCode: item.product.barcode ?? null,
      quantity: new Prisma.Decimal(qty),
      unitPrice: new Prisma.Decimal(unitPrice),
      discountAmount: new Prisma.Decimal(discountAmount),
      subtotal: new Prisma.Decimal(lineSubtotal),
      taxRate: new Prisma.Decimal(taxRate),
      taxAmount: new Prisma.Decimal(taxAmount),
      total: new Prisma.Decimal(lineSubtotal + taxAmount),
    };
  });

  const sriSubtotal = lines.reduce((acc, l) => acc + Number(l.subtotal), 0);
  const sriTaxTotal = lines.reduce((acc, l) => acc + Number(l.taxAmount), 0);
  const sriDiscountTotal = lines.reduce((acc, l) => acc + Number(l.discountAmount), 0);

  const document = await prisma.sriDocument.create({
    data: {
      tenantId,
      sourceType: "BASIC_SALE",
      sourceId: saleId,
      documentType: "INVOICE",
      status: "DRAFT",
      environment: profile.environment,
      establishmentId: establishment.id,
      issuePointId: issuePoint.id,
      customerName: fiscalCustomer.name,
      customerIdentification: fiscalCustomer.identification,
      customerIdentificationType: fiscalCustomer.identificationType,
      customerEmail: sale.customer?.email ?? null,
      customerPhone: sale.customer?.phone ?? null,
      subtotal: new Prisma.Decimal(sriSubtotal),
      taxTotal: new Prisma.Decimal(sriTaxTotal),
      discountTotal: new Prisma.Decimal(sriDiscountTotal),
      grandTotal: new Prisma.Decimal(sriSubtotal + sriTaxTotal),
      lines: { create: lines },
    },
    select: { id: true },
  });

  return { documentId: document.id, alreadyExists: false };
}

type ReservedSriDocumentNumbering = {
  sequenceId: string;
  sequentialNumber: number;
  accessKey: string;
  issuedAt: Date;
};

type LockedSriDocumentRow = {
  id: string;
  tenantId: string;
  status: string;
  documentType: string;
  environment: "TEST" | "PRODUCTION";
  establishmentId: string;
  issuePointId: string;
  sequenceId: string | null;
  sequentialNumber: number | null;
  accessKey: string | null;
  issuedAt: Date | null;
  createdAt: Date;
};

type LockedSriSequenceRow = {
  id: string;
  currentNumber: number;
  maxNumber: number | null;
};

export async function reserveSriDocumentNumberingForTesting(params: {
  tenantId: string;
  documentId: string;
}): Promise<ReservedSriDocumentNumbering> {
  await requireTenantOperationalAccess(params.tenantId);
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const lockedDocs = await tx.$queryRaw<LockedSriDocumentRow[]>`
      SELECT
        id,
        "tenantId",
        status,
        "documentType",
        environment,
        "establishmentId",
        "issuePointId",
        "sequenceId",
        "sequentialNumber",
        "accessKey",
        "issuedAt",
        "createdAt"
      FROM "SriDocument"
      WHERE id = ${params.documentId} AND "tenantId" = ${params.tenantId}
      FOR UPDATE
    `;

    const doc = lockedDocs[0];
    if (!doc) {
      throw new Error("Comprobante no encontrado o no pertenece a este tenant.");
    }

    if (doc.status !== "DRAFT" && doc.status !== "READY_FOR_TESTING") {
      throw new Error("Solo se puede reservar numeracion para comprobantes en borrador o listos para pruebas.");
    }

    if (doc.accessKey && doc.sequentialNumber == null) {
      throw new Error("El comprobante tiene clave persistida pero no secuencial. Corrige la numeracion antes de continuar.");
    }

    const [profile, establishment, issuePoint] = await Promise.all([
      tx.sriTaxpayerProfile.findUnique({
        where: { tenantId: params.tenantId },
        select: { ruc: true },
      }),
      tx.sriEstablishment.findUnique({
        where: { id: doc.establishmentId },
        select: { code: true },
      }),
      tx.sriIssuePoint.findUnique({
        where: { id: doc.issuePointId },
        select: { code: true },
      }),
    ]);

    if (!profile) {
      throw new Error("Perfil SRI no configurado.");
    }
    if (!establishment) {
      throw new Error("Establecimiento no encontrado para este comprobante.");
    }
    if (!issuePoint) {
      throw new Error("Punto de emision no encontrado para este comprobante.");
    }

    let sequenceId = doc.sequenceId;
    let sequentialNumber = doc.sequentialNumber;
    let shouldAdvanceSequence = false;

    if (sequentialNumber == null || !sequenceId) {
      const lockedSequences = await tx.$queryRaw<LockedSriSequenceRow[]>`
        SELECT id, "currentNumber", "maxNumber"
        FROM "SriDocumentSequence"
        WHERE
          "tenantId" = ${params.tenantId}
          AND "establishmentId" = ${doc.establishmentId}
          AND "issuePointId" = ${doc.issuePointId}
          AND "documentType" = ${doc.documentType}::"SriDocumentType"
          AND "isActive" = true
        FOR UPDATE
      `;

      const sequence = lockedSequences[0];
      if (!sequence) {
        throw new Error("No hay secuencia activa para este establecimiento y punto de emision.");
      }

      sequenceId = sequence.id;
      if (sequentialNumber == null) {
        if (sequence.maxNumber != null && sequence.currentNumber > sequence.maxNumber) {
          throw new Error("La secuencia activa ya alcanzo su numero maximo configurado.");
        }
        sequentialNumber = sequence.currentNumber;
        shouldAdvanceSequence = true;
      }
    }

    if (sequentialNumber == null || !sequenceId) {
      throw new Error("No se pudo resolver la secuencia persistida para este comprobante.");
    }

    const issuedAt = doc.issuedAt ?? new Date();
    const accessKey =
      doc.accessKey ??
      buildSriAccessKey({
        issuedAt,
        documentType: doc.documentType,
        ruc: profile.ruc,
        environment: doc.environment,
        establishmentCode: establishment.code,
        issuePointCode: issuePoint.code,
        sequentialNumber,
        numericCode: createStableNumericCode(doc.id),
      }).accessKey;

    await tx.sriDocument.update({
      where: { id: doc.id },
      data: {
        sequenceId,
        sequentialNumber,
        accessKey,
        issuedAt,
      },
    });

    if (shouldAdvanceSequence) {
      await tx.sriDocumentSequence.update({
        where: { id: sequenceId },
        data: { currentNumber: { increment: 1 } },
      });
    }

    return {
      sequenceId,
      sequentialNumber,
      accessKey,
      issuedAt,
    };
  });
}
