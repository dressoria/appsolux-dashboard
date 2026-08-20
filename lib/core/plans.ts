import "@/lib/security/server-only";

import { cache } from "react";

import { getPrismaClient } from "@/lib/db/prisma";

export type PlanKey = "free" | "trial" | "pro" | "enterprise";
export type PlanFeatureKey =
  | "basic_pos"
  | "basic_products"
  | "basic_customers"
  | "basic_sales"
  | "basic_credit"
  | "dedicated_erp"
  | "sri"
  | "advanced_reports"
  | "automations";
export type PlanLimitKey =
  | "products"
  | "customers"
  | "receipts"
  | "openOrders"
  | "activeCredits"
  | "users"
  | "warehouses"
  | "issuePoints";

export type PlanFeatures = Record<PlanFeatureKey, boolean | "manual" | "future">;
export type PlanLimits = Record<PlanLimitKey, number>;

export type TenantPlanGateState = {
  planKey: PlanKey;
  planName: string;
  status: "active" | "trialing" | "past_due" | "suspended" | "canceled" | "manual";
  subscription: Awaited<ReturnType<typeof getTenantSubscription>> | null;
  trialEndsAt?: Date | null;
  currentPeriodEndsAt?: Date | null;
  features: PlanFeatures;
  limits: PlanLimits;
  canUseBasicPos: boolean;
  canUseBasicProducts: boolean;
  canUseBasicCustomers: boolean;
  canUseBasicSales: boolean;
  canUseCreditSales: boolean;
  canRequestDedicatedErp: boolean;
  canUseAdvancedReports: boolean;
  canUseSri: boolean;
  isFreeLike: boolean;
  isPaidLike: boolean;
};

export const defaultPlanDefinitions: Record<
  PlanKey,
  {
    key: PlanKey;
    name: string;
    description: string;
    limits: PlanLimits;
    features: PlanFeatures;
  }
> = {
  free: {
    key: "free",
    name: "Básico",
    description: "Todo lo necesario para facturar y controlar un pequeño negocio.",
    limits: {
      products: 200,
      customers: 20,
      receipts: 20,
      openOrders: 10,
      activeCredits: 5,
      users: 1,
      warehouses: 1,
      issuePoints: 1,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: false,
      sri: true,
      advanced_reports: false,
      automations: false,
    },
  },
  trial: {
    key: "trial",
    name: "Básico",
    description: "Plan Básico completo durante el periodo de prueba.",
    limits: {
      products: 200,
      customers: 50,
      receipts: 50,
      openOrders: 20,
      activeCredits: 10,
      users: 1,
      warehouses: 1,
      issuePoints: 1,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: false,
      sri: true,
      advanced_reports: false,
      automations: false,
    },
  },
  pro: {
    key: "pro",
    name: "Negocio",
    description: "Plan operativo con ERP dedicado y reportes avanzados.",
    limits: {
      products: 5000,
      customers: 5000,
      receipts: 10000,
      openOrders: 1000,
      activeCredits: 500,
      users: 5,
      warehouses: 3,
      issuePoints: 3,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: true,
      sri: true,
      advanced_reports: true,
      automations: true,
    },
  },
  enterprise: {
    key: "enterprise",
    name: "Empresarial",
    description: "Gestión avanzada para equipos y operaciones más grandes.",
    limits: {
      products: 100000,
      customers: 100000,
      receipts: 100000,
      openOrders: 10000,
      activeCredits: 10000,
      users: 100,
      warehouses: 50,
      issuePoints: 50,
    },
    features: {
      basic_pos: true,
      basic_products: true,
      basic_customers: true,
      basic_sales: true,
      basic_credit: true,
      dedicated_erp: true,
      sri: true,
      advanced_reports: true,
      automations: true,
    },
  },
};

export const basicOperationalLimits: PlanLimits = {
  ...defaultPlanDefinitions.trial.limits,
};

function isPlanKey(value: string | null | undefined): value is PlanKey {
  return (
    value === "free" ||
    value === "trial" ||
    value === "pro" ||
    value === "enterprise"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFeatures(value: unknown, fallback: PlanFeatures): PlanFeatures {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    ...fallback,
    ...Object.fromEntries(
      Object.entries(value).filter(([, item]) => item === true || item === false || item === "manual" || item === "future")
    ),
  } as PlanFeatures;
}

function readLimits(value: unknown, fallback: PlanLimits): PlanLimits {
  if (!isRecord(value)) {
    return fallback;
  }

  const next = { ...fallback };

  for (const key of Object.keys(next) as PlanLimitKey[]) {
    const limit = value[key];

    if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) {
      next[key] = limit;
    }
  }

  return next;
}

function featureEnabled(features: PlanFeatures, key: PlanFeatureKey) {
  return features[key] === true;
}

export function getDefaultPlanKey(): PlanKey {
  return "free";
}

export function getPlanLimits(planKey: string | null | undefined): PlanLimits {
  return defaultPlanDefinitions[isPlanKey(planKey) ? planKey : getDefaultPlanKey()].limits;
}

export function getPlanFeatures(planKey: string | null | undefined): PlanFeatures {
  return defaultPlanDefinitions[isPlanKey(planKey) ? planKey : getDefaultPlanKey()].features;
}

export function getOperationalPlanLimits(input: {
  effectiveOperatingMode: "CORE" | "SHARED_ERP" | "DEDICATED_ERP";
  planLimits: PlanLimits;
}) {
  if (input.effectiveOperatingMode === "CORE") {
    return basicOperationalLimits;
  }

  return input.planLimits;
}

export const getTenantSubscription = cache(async function getTenantSubscription(tenantId: string) {
  const prisma = getPrismaClient();

  return prisma.tenantSubscription.findFirst({
    where: {
      tenantId,
    },
    include: {
      plan: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });
});

export async function getTenantPlanState(
  tenantId: string
): Promise<TenantPlanGateState> {
  const prisma = getPrismaClient();
  const fallbackPlanKey = getDefaultPlanKey();
  let planKey: PlanKey = fallbackPlanKey;
  let planName = defaultPlanDefinitions[fallbackPlanKey].name;
  let status: TenantPlanGateState["status"] = "suspended";
  let subscription: Awaited<ReturnType<typeof getTenantSubscription>> | null = null;
  let trialEndsAt: Date | null | undefined;
  let currentPeriodEndsAt: Date | null | undefined;
  let limits = defaultPlanDefinitions[fallbackPlanKey].limits;
  let features = defaultPlanDefinitions[fallbackPlanKey].features;

  try {
    subscription = await getTenantSubscription(tenantId);

    if (subscription && isPlanKey(subscription.plan.key)) {
      planKey = subscription.plan.key;
      planName = subscription.plan.name;
      status = subscription.status;
      trialEndsAt = subscription.trialEndsAt;
      currentPeriodEndsAt = subscription.currentPeriodEndsAt;
      limits = readLimits(
        subscription.plan.limits,
        defaultPlanDefinitions[planKey].limits
      );
      features = readFeatures(
        subscription.plan.features,
        defaultPlanDefinitions[planKey].features
      );
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { planKey: true },
      });

      if (isPlanKey(tenant?.planKey)) {
        planKey = tenant.planKey;
        planName = defaultPlanDefinitions[planKey].name;
        limits = defaultPlanDefinitions[planKey].limits;
        features = defaultPlanDefinitions[planKey].features;
      }
    }
  } catch {
    planKey = fallbackPlanKey;
    planName = defaultPlanDefinitions[fallbackPlanKey].name;
    limits = defaultPlanDefinitions[fallbackPlanKey].limits;
    features = defaultPlanDefinitions[fallbackPlanKey].features;
  }

  const isFreeLike = planKey === "free" || planKey === "trial";
  const isPaidLike = planKey === "pro" || planKey === "enterprise";
  // Feature visibility is read access. Billing write enforcement is resolved by
  // requireTenantOperationalAccess so suspension never hides or deletes history.
  const effectiveFeatures: PlanFeatures = { ...features, sri: true };

  return {
    planKey,
    planName,
    status,
    subscription,
    trialEndsAt,
    currentPeriodEndsAt,
    features: effectiveFeatures,
    limits,
    canUseBasicPos: featureEnabled(effectiveFeatures, "basic_pos"),
    canUseBasicProducts: featureEnabled(effectiveFeatures, "basic_products"),
    canUseBasicCustomers: featureEnabled(effectiveFeatures, "basic_customers"),
    canUseBasicSales: featureEnabled(effectiveFeatures, "basic_sales"),
    canUseCreditSales: featureEnabled(effectiveFeatures, "basic_credit"),
    canRequestDedicatedErp: featureEnabled(effectiveFeatures, "dedicated_erp"),
    canUseAdvancedReports: featureEnabled(effectiveFeatures, "advanced_reports"),
    canUseSri: featureEnabled(effectiveFeatures, "sri"),
    isFreeLike,
    isPaidLike,
  };
}

export async function canUseFeature(
  tenantId: string,
  featureKey: PlanFeatureKey
) {
  const plan = await getTenantPlanState(tenantId);

  return featureEnabled(plan.features, featureKey);
}

export async function canRequestDedicatedErp(tenantId: string) {
  return canUseFeature(tenantId, "dedicated_erp");
}

export async function getLimit(tenantId: string, limitKey: PlanLimitKey) {
  const plan = await getTenantPlanState(tenantId);

  return plan.limits[limitKey];
}

export async function buildPlanGateState(tenantId: string) {
  return getTenantPlanState(tenantId);
}
