import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type {
  IntegrationProvider,
  Prisma,
  TenantIntegrationStatus,
} from "@prisma/client";

export type CreateTenantIntegrationInput = {
  tenantId: string;
  instanceId: string;
  provider: IntegrationProvider;
  externalAccountId?: string;
  externalSiteName?: string;
  externalCompanyId?: string;
  externalInstanceName?: string;
  status?: TenantIntegrationStatus;
  config?: Prisma.InputJsonObject;
  lastError?: string;
};

export async function createTenantIntegration(
  input: CreateTenantIntegrationInput
) {
  const prisma = getPrismaClient();

  return prisma.tenantIntegration.create({
    data: {
      tenantId: input.tenantId,
      instanceId: input.instanceId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      externalSiteName: input.externalSiteName,
      externalCompanyId: input.externalCompanyId,
      externalInstanceName: input.externalInstanceName,
      status: input.status ?? "pending",
      config: input.config,
      lastError: input.lastError,
    },
  });
}

export async function getTenantIntegrations(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.tenantIntegration.findMany({
    where: { tenantId },
    include: { instance: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getTenantIntegrationByProvider(
  tenantId: string,
  provider: IntegrationProvider
) {
  const prisma = getPrismaClient();

  return prisma.tenantIntegration.findUnique({
    where: {
      tenantId_provider: {
        tenantId,
        provider,
      },
    },
    include: { instance: true },
  });
}
