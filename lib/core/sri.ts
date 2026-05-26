import "@/lib/security/server-only";
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
  readinessLabel: "not_started" | "incomplete" | "ready_for_testing" | "production_ready";
};

export async function getSriModuleStatus(tenantId: string): Promise<SriModuleStatus> {
  const prisma = getPrismaClient();

  const profile = await prisma.sriTaxpayerProfile.findUnique({
    where: { tenantId },
    include: {
      establishments: { where: { isActive: true }, select: { id: true } },
      signatureConfig: { select: { status: true } },
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
      readinessLabel: "not_started",
    };
  }

  const [issuePointCount, sequenceCount] = await Promise.all([
    prisma.sriIssuePoint.count({ where: { tenantId, isActive: true } }),
    prisma.sriDocumentSequence.count({ where: { tenantId, isActive: true } }),
  ]);

  const establishmentCount = profile.establishments.length;
  const signatureStatus = profile.signatureConfig?.status ?? null;

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
    readinessLabel,
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
