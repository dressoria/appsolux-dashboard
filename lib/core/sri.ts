import "@/lib/security/server-only";
import { Prisma, SriDocumentType } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";

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

  let readinessLabel: SriModuleStatus["readinessLabel"] = "incomplete";
  if (profile.status === "CONFIGURED" && establishmentCount > 0 && issuePointCount > 0 && sequenceCount > 0) {
    readinessLabel =
      signatureStatus === "READY_FOR_TESTING"
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
  return prisma.sriIssuePoint.create({ data: { tenantId, ...data } });
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

  return prisma.sriSignatureConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      profileId: profile.id,
      status: "UPLOADED_METADATA_ONLY",
      certificateUploadedAt: new Date(),
      ...data,
    },
    update: {
      status: "UPLOADED_METADATA_ONLY",
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
  return /^\d{13}$/.test(ruc.trim());
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
    select: { id: true, status: true },
  });
}

export async function createDraftSriDocumentFromBasicSale({
  tenantId,
  saleId,
}: {
  tenantId: string;
  saleId: string;
}): Promise<{ documentId: string; alreadyExists: boolean }> {
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
      customer: { select: { name: true, email: true, phone: true } },
      items: { include: { product: { select: { name: true, barcode: true } } } },
    },
  });
  if (!sale) throw new Error("Venta no encontrada.");
  if (sale.status === "canceled") throw new Error("La venta esta cancelada y no puede prepararse como comprobante.");

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
    const lineSubtotal = qty * unitPrice;
    // Basic POS has no IVA tracking — tax rate is 0 explicitly
    return {
      itemName: item.product.name,
      itemCode: item.product.barcode ?? null,
      quantity: new Prisma.Decimal(qty),
      unitPrice: new Prisma.Decimal(unitPrice),
      discountAmount: new Prisma.Decimal(0),
      subtotal: new Prisma.Decimal(lineSubtotal),
      taxRate: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(lineSubtotal),
    };
  });

  const subtotal = lines.reduce((acc, l) => acc + Number(l.subtotal), 0);

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
      customerName: sale.customer?.name ?? "Consumidor Final",
      customerIdentification: null,
      customerEmail: sale.customer?.email ?? null,
      customerPhone: sale.customer?.phone ?? null,
      subtotal: new Prisma.Decimal(subtotal),
      taxTotal: new Prisma.Decimal(0),
      discountTotal: new Prisma.Decimal(0),
      grandTotal: new Prisma.Decimal(subtotal),
      lines: { create: lines },
    },
    select: { id: true },
  });

  return { documentId: document.id, alreadyExists: false };
}
