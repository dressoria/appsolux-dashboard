import "@/lib/security/server-only";

import { Prisma, TenantSubscriptionStatus } from "@prisma/client";
import type {
  FeatureKey,
  OperatingMode,
  TenantOperationalStatus,
} from "../../node_modules/.prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import {
  allTenantFeatureKeys,
  mapLegacyPlanKeyToCommercialPlan,
} from "@/lib/core/commercial-plans";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getTenantPlanState, type PlanKey } from "@/lib/core/plans";
import {
  resolveEffectiveTenantAccess,
  type TenantFeatureOverrideRecord,
  type TenantOperationalConfigRecord,
} from "@/lib/core/tenant-features";
import type { AppsoluxTenant } from "@/types/tenant";

export const manualBillingPlanKeys = [
  "free",
  "trial",
  "pro",
  "enterprise",
] as const;
export const manualBillingStatuses = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "manual",
] as const;

export type ManualBillingPlanKey = (typeof manualBillingPlanKeys)[number];
export type ManualBillingStatus = (typeof manualBillingStatuses)[number];
export const operationalModes = ["CORE", "SHARED_ERP", "DEDICATED_ERP"] as const;
export const operationalStatuses = [
  "active",
  "pending_setup",
  "suspended",
  "disabled",
] as const;

export type ManualOperatingMode = (typeof operationalModes)[number];
export type ManualOperationalStatus = (typeof operationalStatuses)[number];

export function isManualBillingPlanKey(
  value: unknown
): value is ManualBillingPlanKey {
  return typeof value === "string" && manualBillingPlanKeys.includes(value as ManualBillingPlanKey);
}

export function isManualBillingStatus(
  value: unknown
): value is ManualBillingStatus {
  return typeof value === "string" && manualBillingStatuses.includes(value as ManualBillingStatus);
}

export function isOperatingModeValue(value: unknown): value is OperatingMode {
  return typeof value === "string" && operationalModes.includes(value as ManualOperatingMode);
}

export function isTenantOperationalStatusValue(
  value: unknown
): value is TenantOperationalStatus {
  return typeof value === "string" && operationalStatuses.includes(value as ManualOperationalStatus);
}

export function isFeatureKeyValue(value: unknown): value is FeatureKey {
  return typeof value === "string" && allTenantFeatureKeys.includes(value as FeatureKey);
}

function cleanOptionalText(value: unknown, maxLength = 1000) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function asAppTenant(input: {
  id: string;
  name: string;
  slug: string;
  integrations: Array<{
    provider: string;
    status: string;
    externalAccountId: string | null;
    externalCompanyId: string | null;
    externalSiteName: string | null;
    externalInstanceName: string | null;
    config: Prisma.JsonValue | null;
    lastError: string | null;
  }>;
}): AppsoluxTenant {
  const chatwoot = input.integrations.find((item) => item.provider === "chatwoot");
  const erpnext = input.integrations.find((item) => item.provider === "erpnext");
  const evolution = input.integrations.find((item) => item.provider === "evolution");

  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    chatwoot_account_id: Number(chatwoot?.externalAccountId ?? 0),
    erpnext_company_id: erpnext?.externalCompanyId ?? undefined,
    channels: {
      evolution: {
        enabled: Boolean(evolution?.externalInstanceName),
        instance_name: evolution?.externalInstanceName ?? undefined,
        status: evolution ? "pending" : "pending",
      },
    },
  };
}

export async function listTenantBillingStates() {
  const prisma = getPrismaClient();
  const tenants = await prisma.tenant.findMany({
    include: {
      integrations: true,
      operationalConfig: true,
      featureOverrides: {
        orderBy: [{ featureKey: "asc" }],
      },
      memberships: {
        where: { role: "owner" },
        include: { user: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    tenants.map(async (tenant) => {
      const [plan, erp] = await Promise.all([
        getTenantPlanState(tenant.id),
        getErpProvisioningState(asAppTenant(tenant)),
      ]);
      const commercialPlan = mapLegacyPlanKeyToCommercialPlan(plan.planKey);
      const fallbackOperationalConfig: TenantOperationalConfigRecord = {
        operatingMode: "CORE",
        status: "active",
        sriEnabled: false,
        sharedErpEnabled: false,
        dedicatedErpEnabled: false,
        suspendedAt: null,
        notes: null,
      };
      const operationalConfig =
        (tenant.operationalConfig as TenantOperationalConfigRecord | null) ??
        fallbackOperationalConfig;
      const effectiveAccess = resolveEffectiveTenantAccess({
        commercialPlan,
        legacyPlanKey: plan.planKey,
        operationalConfig,
        overrides: tenant.featureOverrides as TenantFeatureOverrideRecord[],
        erpProvisioning: erp,
      });

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        ownerEmail: tenant.memberships[0]?.user.email ?? null,
        planKey: plan.planKey,
        planName: plan.planName,
        status: plan.status,
        trialEndsAt: plan.trialEndsAt,
        currentPeriodEndsAt: plan.currentPeriodEndsAt,
        canRequestDedicatedErp: plan.canRequestDedicatedErp,
        commercialPlan,
        operationalConfig,
        configuredOperatingMode: effectiveAccess.configuredOperatingMode,
        effectiveOperatingMode: effectiveAccess.effectiveOperatingMode,
        operationalStatus: effectiveAccess.operationalStatus,
        effectiveFeatures: effectiveAccess.features,
        featureOverrides: tenant.featureOverrides,
        configBackfillPending: tenant.operationalConfig === null,
        erpStatus: erp.status,
        erpDisplayStatus: erp.displayStatus,
        hasRealDedicatedErp: erp.isRealActive,
        hasPendingDedicatedErp:
          erp.isPending || erp.isSimulated || erp.isFailed,
        sriEnabled: operationalConfig.sriEnabled,
        sharedErpEnabled: operationalConfig.sharedErpEnabled,
        dedicatedErpEnabled: operationalConfig.dedicatedErpEnabled,
      };
    })
  );
}

export async function setTenantPlanManually(input: {
  actorUserId: string;
  tenantId: string;
  planKey: PlanKey;
  status: TenantSubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodEndsAt?: Date | null;
}) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({
      where: { key: input.planKey },
    });

    if (!plan) {
      throw new Error("Plan no encontrado. Ejecuta maintenance:ensure-plans.");
    }

    const current = await tx.tenantSubscription.findFirst({
      where: { tenantId: input.tenantId },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
    const subscription = current
      ? await tx.tenantSubscription.update({
          where: { id: current.id },
          data: {
            planId: plan.id,
            status: input.status,
            trialEndsAt: input.trialEndsAt,
            currentPeriodEndsAt: input.currentPeriodEndsAt,
          },
          include: { plan: true },
        })
      : await tx.tenantSubscription.create({
          data: {
            tenantId: input.tenantId,
            planId: plan.id,
            status: input.status,
            trialEndsAt: input.trialEndsAt,
            currentPeriodEndsAt: input.currentPeriodEndsAt,
          },
          include: { plan: true },
        });

    await tx.tenant.update({
      where: { id: input.tenantId },
      data: { planKey: input.planKey },
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.actorUserId,
        action: "tenant_subscription.manual_update",
        entityType: "TenantSubscription",
        entityId: subscription.id,
        metadata: {
          previousPlanKey: current?.plan.key ?? null,
          nextPlanKey: input.planKey,
          previousStatus: current?.status ?? null,
          nextStatus: input.status,
          trialEndsAt: input.trialEndsAt?.toISOString() ?? null,
          currentPeriodEndsAt: input.currentPeriodEndsAt?.toISOString() ?? null,
        },
      },
    });

    return subscription;
  });
}

export async function updateTenantOperationalConfig(input: {
  actorUserId: string;
  tenantId: string;
  operatingMode: OperatingMode;
  status: TenantOperationalStatus;
  sriEnabled: boolean;
  sharedErpEnabled: boolean;
  dedicatedErpEnabled: boolean;
  notes?: string | null;
}) {
  const prisma = getPrismaClient();
  const normalizedNotes = cleanOptionalText(input.notes);

  const normalizedFlags =
    input.operatingMode === "CORE"
      ? {
          sharedErpEnabled: false,
          dedicatedErpEnabled: false,
        }
      : input.operatingMode === "SHARED_ERP"
        ? {
            sharedErpEnabled: input.sharedErpEnabled,
            dedicatedErpEnabled: false,
          }
        : {
            sharedErpEnabled: false,
            dedicatedErpEnabled: input.dedicatedErpEnabled,
          };

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new Error("Tenant no encontrado.");
    }

    const current = await tx.tenantOperationalConfig.findUnique({
      where: { tenantId: input.tenantId },
    });

    const config = await tx.tenantOperationalConfig.upsert({
      where: { tenantId: input.tenantId },
      create: {
        tenantId: input.tenantId,
        operatingMode: input.operatingMode,
        status: input.status,
        sriEnabled: input.sriEnabled,
        sharedErpEnabled: normalizedFlags.sharedErpEnabled,
        dedicatedErpEnabled: normalizedFlags.dedicatedErpEnabled,
        suspendedAt:
          input.status === "suspended" ? new Date() : null,
        notes: normalizedNotes,
      },
      update: {
        operatingMode: input.operatingMode,
        status: input.status,
        sriEnabled: input.sriEnabled,
        sharedErpEnabled: normalizedFlags.sharedErpEnabled,
        dedicatedErpEnabled: normalizedFlags.dedicatedErpEnabled,
        suspendedAt:
          input.status === "suspended"
            ? current?.suspendedAt ?? new Date()
            : null,
        notes: normalizedNotes,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.actorUserId,
        action: "tenant_operational_config.updated",
        entityType: "TenantOperationalConfig",
        entityId: config.id,
        metadata: {
          previous: current
            ? {
                operatingMode: current.operatingMode,
                status: current.status,
                sriEnabled: current.sriEnabled,
                sharedErpEnabled: current.sharedErpEnabled,
                dedicatedErpEnabled: current.dedicatedErpEnabled,
                notes: current.notes,
              }
            : null,
          next: {
            operatingMode: config.operatingMode,
            status: config.status,
            sriEnabled: config.sriEnabled,
            sharedErpEnabled: config.sharedErpEnabled,
            dedicatedErpEnabled: config.dedicatedErpEnabled,
            notes: config.notes,
          },
        },
      },
    });

    return config;
  });
}

export async function upsertTenantFeatureOverride(input: {
  actorUserId: string;
  tenantId: string;
  featureKey: FeatureKey;
  enabled: boolean;
  notes?: string | null;
}) {
  const prisma = getPrismaClient();
  const normalizedNotes = cleanOptionalText(input.notes);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new Error("Tenant no encontrado.");
    }

    const current = await tx.tenantFeatureOverride.findUnique({
      where: {
        tenantId_featureKey: {
          tenantId: input.tenantId,
          featureKey: input.featureKey,
        },
      },
    });

    const override = await tx.tenantFeatureOverride.upsert({
      where: {
        tenantId_featureKey: {
          tenantId: input.tenantId,
          featureKey: input.featureKey,
        },
      },
      create: {
        tenantId: input.tenantId,
        featureKey: input.featureKey,
        enabled: input.enabled,
        source: "ADMIN",
        notes: normalizedNotes,
        createdById: input.actorUserId,
      },
      update: {
        enabled: input.enabled,
        source: "ADMIN",
        notes: normalizedNotes,
        createdById: input.actorUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.actorUserId,
        action: "tenant_feature_override.upserted",
        entityType: "TenantFeatureOverride",
        entityId: override.id,
        metadata: {
          featureKey: input.featureKey,
          previousEnabled: current?.enabled ?? null,
          nextEnabled: override.enabled,
          notes: override.notes,
        },
      },
    });

    return override;
  });
}

export async function removeTenantFeatureOverride(input: {
  actorUserId: string;
  tenantId: string;
  featureKey: FeatureKey;
}) {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const current = await tx.tenantFeatureOverride.findUnique({
      where: {
        tenantId_featureKey: {
          tenantId: input.tenantId,
          featureKey: input.featureKey,
        },
      },
    });

    if (!current) {
      return null;
    }

    await tx.tenantFeatureOverride.delete({
      where: { id: current.id },
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.actorUserId,
        action: "tenant_feature_override.deleted",
        entityType: "TenantFeatureOverride",
        entityId: current.id,
        metadata: {
          featureKey: input.featureKey,
          previousEnabled: current.enabled,
          notes: current.notes,
        },
      },
    });

    return current;
  });
}
