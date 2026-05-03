import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type {
  IntegrationProvider,
  IntegrationInstanceStatus,
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
  lastError?: string | null;
};

export type UpsertIntegrationInstanceInput = {
  provider: IntegrationProvider;
  name: string;
  baseUrl?: string;
  status?: IntegrationInstanceStatus;
  metadata?: Prisma.InputJsonObject;
};

export type UpdateTenantIntegrationInput = {
  externalAccountId?: string | null;
  externalSiteName?: string | null;
  externalCompanyId?: string | null;
  externalInstanceName?: string | null;
  status?: TenantIntegrationStatus;
  config?: Prisma.InputJsonObject;
  lastError?: string | null;
};

export async function upsertIntegrationInstance(
  input: UpsertIntegrationInstanceInput
) {
  const prisma = getPrismaClient();

  return prisma.integrationInstance.upsert({
    where: { name: input.name },
    create: {
      provider: input.provider,
      name: input.name,
      baseUrl: input.baseUrl,
      status: input.status ?? "active",
      metadata: input.metadata,
    },
    update: {
      provider: input.provider,
      baseUrl: input.baseUrl,
      status: input.status ?? "active",
      metadata: input.metadata,
    },
  });
}

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

export async function getTenantIntegrationByExternalInstanceName(
  externalInstanceName: string
) {
  const prisma = getPrismaClient();

  return prisma.tenantIntegration.findFirst({
    where: {
      provider: "evolution",
      externalInstanceName,
    },
    include: {
      instance: true,
      tenant: {
        include: {
          integrations: {
            include: { instance: true },
          },
        },
      },
    },
  });
}

export async function upsertTenantIntegration(
  input: CreateTenantIntegrationInput
) {
  const prisma = getPrismaClient();

  return prisma.tenantIntegration.upsert({
    where: {
      tenantId_provider: {
        tenantId: input.tenantId,
        provider: input.provider,
      },
    },
    create: {
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
    update: {
      instanceId: input.instanceId,
      externalAccountId: input.externalAccountId,
      externalSiteName: input.externalSiteName,
      externalCompanyId: input.externalCompanyId,
      externalInstanceName: input.externalInstanceName,
      status: input.status ?? "pending",
      config: input.config,
      lastError: input.lastError,
    },
    include: { instance: true },
  });
}

export async function updateTenantIntegration(
  tenantId: string,
  provider: IntegrationProvider,
  input: UpdateTenantIntegrationInput
) {
  const prisma = getPrismaClient();
  const data: Prisma.TenantIntegrationUpdateInput = {
    externalAccountId: input.externalAccountId,
    externalSiteName: input.externalSiteName,
    externalCompanyId: input.externalCompanyId,
    externalInstanceName: input.externalInstanceName,
    status: input.status,
    config: input.config,
    lastError: input.lastError,
  };

  return prisma.tenantIntegration.update({
    where: {
      tenantId_provider: {
        tenantId,
        provider,
      },
    },
    data,
    include: { instance: true },
  });
}

export async function markTenantIntegrationProvisioning(input: {
  tenantId: string;
  instanceId: string;
  provider: IntegrationProvider;
}) {
  return upsertTenantIntegration({
    tenantId: input.tenantId,
    instanceId: input.instanceId,
    provider: input.provider,
    status: "provisioning",
    lastError: null,
  });
}

export async function markTenantIntegrationActive(input: {
  tenantId: string;
  provider: IntegrationProvider;
  externalAccountId?: string;
  externalSiteName?: string;
  externalCompanyId?: string;
  externalInstanceName?: string;
  config?: Prisma.InputJsonObject;
}) {
  return updateTenantIntegration(input.tenantId, input.provider, {
    externalAccountId: input.externalAccountId,
    externalSiteName: input.externalSiteName,
    externalCompanyId: input.externalCompanyId,
    externalInstanceName: input.externalInstanceName,
    config: input.config,
    status: "active",
    lastError: null,
  });
}

export async function markTenantIntegrationFailed(input: {
  tenantId: string;
  provider: IntegrationProvider;
  lastError: string;
}) {
  return updateTenantIntegration(input.tenantId, input.provider, {
    status: "failed",
    lastError: input.lastError,
  });
}
