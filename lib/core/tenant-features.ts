import "@/lib/security/server-only";

import { cache } from "react";

import type {
  CommercialPlan,
  FeatureKey,
  FeatureSource,
  OperatingMode,
  PrismaClient,
  TenantFeatureOverride,
  TenantOperationalConfig,
  TenantOperationalStatus,
} from "../../node_modules/.prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import type { ErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import {
  allTenantFeatureKeys,
  getDefaultFeaturesForOperatingMode,
  getDefaultFeaturesForPlan,
  getDefaultOperatingModeForPlan,
  mapLegacyPlanKeyToCommercialPlan,
  type TenantFeatureMap,
} from "@/lib/core/commercial-plans";
import { getTenantSubscription, type PlanKey, type TenantPlanGateState } from "@/lib/core/plans";

export type TenantFeatureOverrideRecord = Pick<
  TenantFeatureOverride,
  "featureKey" | "enabled" | "source" | "notes"
>;

export type TenantOperationalConfigRecord = Pick<
  TenantOperationalConfig,
  | "operatingMode"
  | "status"
  | "sriEnabled"
  | "sharedErpEnabled"
  | "dedicatedErpEnabled"
  | "suspendedAt"
  | "notes"
>;

export type EffectiveTenantAccess = {
  commercialPlan: CommercialPlan;
  legacyPlanKey: PlanKey | null;
  configuredOperatingMode: OperatingMode;
  effectiveOperatingMode: OperatingMode;
  operationalStatus: TenantOperationalStatus;
  features: TenantFeatureMap;
  overridesApplied: TenantFeatureOverrideRecord[];
  isSuspended: boolean;
  hasRealDedicatedErp: boolean;
};

function mergeFeatureMaps(...maps: TenantFeatureMap[]) {
  return maps.reduce<TenantFeatureMap>(
    (acc, map) => {
      for (const featureKey of allTenantFeatureKeys) {
        acc[featureKey] = acc[featureKey] || map[featureKey];
      }
      return acc;
    },
    Object.fromEntries(allTenantFeatureKeys.map((featureKey) => [featureKey, false])) as TenantFeatureMap
  );
}

function applyFeatureOverrides(
  features: TenantFeatureMap,
  overrides: TenantFeatureOverrideRecord[]
) {
  const next = { ...features };

  for (const override of overrides) {
    next[override.featureKey] = override.enabled;
  }

  return next;
}

function applyOperationalSafetyRules(input: {
  features: TenantFeatureMap;
  configuredOperatingMode: OperatingMode;
  effectiveOperatingMode: OperatingMode;
  operationalConfig: TenantOperationalConfigRecord | null;
  erpProvisioning: ErpProvisioningState | null;
}) {
  const next = { ...input.features };
  const isSuspended =
    input.operationalConfig?.status === "suspended" ||
    input.operationalConfig?.status === "disabled";

  if (isSuspended) {
    next.pos_basic = false;
    next.sales_basic = false;
    next.inventory_advanced = false;
    next.purchases = false;
    next.warehouses = false;
    next.kardex = false;
    next.advanced_reports = false;
  }

  if (input.effectiveOperatingMode === "CORE") {
    next.shared_erp = false;
    next.dedicated_erp = false;
    next.erp_provisioning = false;
    next.inventory_advanced = false;
    next.purchases = false;
    next.warehouses = false;
    next.kardex = false;
    next.advanced_reports = false;
  }

  if (input.effectiveOperatingMode === "SHARED_ERP") {
    next.dedicated_erp = false;
    next.erp_provisioning = false;
  }

  if (input.configuredOperatingMode !== "DEDICATED_ERP" && !input.operationalConfig?.dedicatedErpEnabled) {
    next.dedicated_erp = false;
    next.erp_provisioning = false;
  }

  if (!input.operationalConfig?.sharedErpEnabled && input.effectiveOperatingMode !== "SHARED_ERP") {
    next.shared_erp = false;
  }

  if (!input.operationalConfig?.sriEnabled) {
    next.sri_invoicing = false;
    next.sri_configuration = false;
  }

  if (!input.erpProvisioning?.isRealActive) {
    next.erp_provisioning = false;
  }

  return next;
}

export function resolveEffectiveOperatingMode(input: {
  commercialPlan: CommercialPlan;
  operationalConfig: TenantOperationalConfigRecord | null;
  erpProvisioning: ErpProvisioningState | null;
}) {
  const configuredOperatingMode =
    input.operationalConfig?.operatingMode ?? getDefaultOperatingModeForPlan(input.commercialPlan);

  if (input.operationalConfig?.status === "suspended" || input.operationalConfig?.status === "disabled") {
    return {
      configuredOperatingMode,
      effectiveOperatingMode: "CORE" as OperatingMode,
    };
  }

  if (configuredOperatingMode === "DEDICATED_ERP") {
    if (
      input.operationalConfig?.dedicatedErpEnabled &&
      input.erpProvisioning?.isRealActive
    ) {
      return {
        configuredOperatingMode,
        effectiveOperatingMode: "DEDICATED_ERP" as OperatingMode,
      };
    }

    return {
      configuredOperatingMode,
      effectiveOperatingMode: "CORE" as OperatingMode,
    };
  }

  if (configuredOperatingMode === "SHARED_ERP") {
    if (input.operationalConfig?.sharedErpEnabled) {
      return {
        configuredOperatingMode,
        effectiveOperatingMode: "SHARED_ERP" as OperatingMode,
      };
    }

    return {
      configuredOperatingMode,
      effectiveOperatingMode: "CORE" as OperatingMode,
    };
  }

  return {
    configuredOperatingMode,
    effectiveOperatingMode: "CORE" as OperatingMode,
  };
}

export function resolveEffectiveTenantAccess(input: {
  commercialPlan: CommercialPlan;
  legacyPlanKey?: PlanKey | null;
  operationalConfig: TenantOperationalConfigRecord | null;
  overrides?: TenantFeatureOverrideRecord[];
  erpProvisioning?: ErpProvisioningState | null;
}) {
  const overrides = input.overrides ?? [];
  const operationalStatus = input.operationalConfig?.status ?? "active";
  const { configuredOperatingMode, effectiveOperatingMode } =
    resolveEffectiveOperatingMode({
      commercialPlan: input.commercialPlan,
      operationalConfig: input.operationalConfig,
      erpProvisioning: input.erpProvisioning ?? null,
    });

  const mergedBaseFeatures = mergeFeatureMaps(
    getDefaultFeaturesForPlan(input.commercialPlan),
    getDefaultFeaturesForOperatingMode(configuredOperatingMode)
  );
  const featuresWithOverrides = applyFeatureOverrides(mergedBaseFeatures, overrides);
  const features = applyOperationalSafetyRules({
    features: featuresWithOverrides,
    configuredOperatingMode,
    effectiveOperatingMode,
    operationalConfig: input.operationalConfig,
    erpProvisioning: input.erpProvisioning ?? null,
  });

  return {
    commercialPlan: input.commercialPlan,
    legacyPlanKey: input.legacyPlanKey ?? null,
    configuredOperatingMode,
    effectiveOperatingMode,
    operationalStatus,
    features,
    overridesApplied: overrides,
    isSuspended: operationalStatus === "suspended" || operationalStatus === "disabled",
    hasRealDedicatedErp: Boolean(input.erpProvisioning?.isRealActive),
  } satisfies EffectiveTenantAccess;
}

export const getTenantOperationalConfig = cache(async function getTenantOperationalConfig(tenantId: string) {
  const prisma = getPrismaClient() as PrismaClient;

  return prisma.tenantOperationalConfig.findUnique({
    where: { tenantId },
  });
});

export const getTenantFeatureOverrides = cache(async function getTenantFeatureOverrides(tenantId: string) {
  const prisma = getPrismaClient() as PrismaClient;

  return prisma.tenantFeatureOverride.findMany({
    where: { tenantId },
    orderBy: [{ featureKey: "asc" }],
  });
});

export async function resolveEffectiveTenantAccessForTenant(input: {
  tenantId: string;
  erpProvisioning?: ErpProvisioningState | null;
  planState?: TenantPlanGateState;
}) {
  const [subscription, operationalConfig, overrides] = await Promise.all([
    getTenantSubscription(input.tenantId),
    getTenantOperationalConfig(input.tenantId),
    getTenantFeatureOverrides(input.tenantId),
  ]);

  const fallbackLegacyPlanKey = input.planState?.planKey ?? null;
  const legacyPlanKey = (subscription?.plan.key as PlanKey | undefined) ?? fallbackLegacyPlanKey;
  const commercialPlan = mapLegacyPlanKeyToCommercialPlan(legacyPlanKey);

  return resolveEffectiveTenantAccess({
    commercialPlan,
    legacyPlanKey,
    operationalConfig,
    overrides,
    erpProvisioning: input.erpProvisioning ?? null,
  });
}

export function featureEnabled(features: TenantFeatureMap, featureKey: FeatureKey) {
  return features[featureKey] === true;
}

export function overrideSourceLabel(source: FeatureSource) {
  if (source === "PLAN") return "Plan";
  if (source === "ADMIN") return "Admin";
  if (source === "BETA") return "Beta";
  if (source === "MIGRATION") return "Migracion";
  return "Sistema";
}
