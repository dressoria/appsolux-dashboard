import "@/lib/security/server-only";

import type {
  BusinessSuiteAccessMode,
  BusinessSuitePlanMode,
  BusinessSuiteStatus,
  CommercialPlan,
  OperatingMode,
  TenantBillingMode,
  TenantOperationalStatus,
} from "../../node_modules/.prisma/client";

import {
  derivePublicPlan,
  mapOperatingModeToBusinessSuiteMode,
  normalizeBillingMode,
  resolveBusinessSuiteStatus,
} from "@/lib/core/business-suite";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getOperationalPlanLimits, getTenantPlanState } from "@/lib/core/plans";
import { canUseAdvancedErp } from "@/lib/core/advanced-erp-access";
import { resolveEffectiveTenantAccessForTenant } from "@/lib/core/tenant-features";
import type { AppsoluxTenant } from "@/types/tenant";

export type TenantModeState = {
  planKey: "free" | "trial" | "pro" | "enterprise";
  planName: string;
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "manual";
  billingMode: TenantBillingMode;
  trialEndsAt?: Date | null;
  currentPeriodEndsAt?: Date | null;
  limits: Awaited<ReturnType<typeof getTenantPlanState>>["limits"];
  operationalLimits: Awaited<ReturnType<typeof getTenantPlanState>>["limits"];
  features: Awaited<ReturnType<typeof getTenantPlanState>>["features"];
  isFreeLike: boolean;
  isPaidLike: boolean;
  canUseBasicMode: boolean;
  canRequestDedicatedErp: boolean;
  hasDedicatedErp: boolean;
  dedicatedErpStatus: string;
  dedicatedErpDisplayStatus: string;
  erpProvisioning: Awaited<ReturnType<typeof getErpProvisioningState>>;
  shouldUseBasicMode: boolean;
  shouldUseAdvancedMode: boolean;
  upgradeCtaLabel: string;
  upgradeCtaHref: string;
  commercialPlan: CommercialPlan;
  publicPlan: BusinessSuitePlanMode;
  businessSuiteMode: BusinessSuiteAccessMode;
  businessSuiteStatus: BusinessSuiteStatus;
  configuredOperatingMode: OperatingMode;
  effectiveOperatingMode: OperatingMode;
  operationalStatus: TenantOperationalStatus;
  effectiveFeatures: Awaited<ReturnType<typeof resolveEffectiveTenantAccessForTenant>>["features"];
  isSuspended: boolean;
  canAccessBasicInventory: boolean;
  canAccessBasicSales: boolean;
  canAccessBasicReports: boolean;
  canAccessAdvancedInventory: boolean;
  canAccessAdvancedReports: boolean;
  canAccessSriConfiguration: boolean;
  canAccessSriInvoicing: boolean;
  canUseAdvancedErp: boolean;
};

export async function getTenantModeState(tenant: AppsoluxTenant): Promise<TenantModeState> {
  const [plan, erp] = await Promise.all([
    getTenantPlanState(tenant.id),
    getErpProvisioningState(tenant),
  ]);
  const effectiveAccess = await resolveEffectiveTenantAccessForTenant({
    tenantId: tenant.id,
    erpProvisioning: erp,
    planState: plan,
  });
  const hasDedicatedErp = erp.isRealActive;
  const shouldUseAdvancedMode =
    effectiveAccess.effectiveOperatingMode === "SHARED_ERP" ||
    effectiveAccess.effectiveOperatingMode === "DEDICATED_ERP";
  const shouldUseBasicMode = !shouldUseAdvancedMode;
  const billingMode = normalizeBillingMode({
    billingMode: plan.subscription?.billingMode,
    subscriptionStatus: plan.status,
  });
  const businessSuiteStatus = resolveBusinessSuiteStatus({
    configuredOperatingMode: effectiveAccess.configuredOperatingMode,
    operationalStatus: effectiveAccess.operationalStatus,
    configuredStatus: effectiveAccess.operationalConfig?.businessSuiteStatus,
    sharedErpEnabled: effectiveAccess.operationalConfig?.sharedErpEnabled ?? false,
    dedicatedErpEnabled: effectiveAccess.operationalConfig?.dedicatedErpEnabled ?? false,
    hasRealDedicatedErp: hasDedicatedErp,
  });
  const publicPlan = derivePublicPlan({
    configuredOperatingMode: effectiveAccess.configuredOperatingMode,
    effectiveOperatingMode: effectiveAccess.effectiveOperatingMode,
    canRequestDedicatedErp: plan.canRequestDedicatedErp,
  });
  const businessSuiteMode = mapOperatingModeToBusinessSuiteMode(
    shouldUseAdvancedMode
      ? effectiveAccess.effectiveOperatingMode
      : effectiveAccess.configuredOperatingMode
  );
  const operationalLimits = getOperationalPlanLimits({
    effectiveOperatingMode: effectiveAccess.effectiveOperatingMode,
    planLimits: plan.limits,
  });

  const tenantMode = {
    planKey: plan.planKey,
    planName: plan.planName,
    subscriptionStatus: plan.status,
    billingMode,
    trialEndsAt: plan.trialEndsAt,
    currentPeriodEndsAt: plan.currentPeriodEndsAt,
    limits: plan.limits,
    operationalLimits,
    features: plan.features,
    isFreeLike: plan.isFreeLike,
    isPaidLike: plan.isPaidLike,
    canUseBasicMode: plan.canUseBasicPos,
    canRequestDedicatedErp: plan.canRequestDedicatedErp,
    hasDedicatedErp,
    dedicatedErpStatus: erp.status,
    dedicatedErpDisplayStatus: erp.displayStatus,
    erpProvisioning: erp,
    shouldUseBasicMode,
    shouldUseAdvancedMode,
    upgradeCtaLabel: plan.canRequestDedicatedErp
      ? "Solicitar Sistema Dedicado"
      : "Mejorar plan para activar Sistema Dedicado",
    upgradeCtaHref: "/billing",
    commercialPlan: effectiveAccess.commercialPlan,
    publicPlan,
    businessSuiteMode,
    businessSuiteStatus,
    configuredOperatingMode: effectiveAccess.configuredOperatingMode,
    effectiveOperatingMode: effectiveAccess.effectiveOperatingMode,
    operationalStatus: effectiveAccess.operationalStatus,
    effectiveFeatures: effectiveAccess.features,
    isSuspended: effectiveAccess.isSuspended,
    canAccessBasicInventory: effectiveAccess.features.inventory_basic,
    canAccessBasicSales: effectiveAccess.features.pos_basic || effectiveAccess.features.sales_basic,
    canAccessBasicReports: effectiveAccess.features.reports_basic,
    canAccessAdvancedInventory:
      effectiveAccess.features.inventory_advanced || effectiveAccess.features.shared_erp,
    canAccessAdvancedReports: effectiveAccess.features.advanced_reports,
    canAccessSriConfiguration: effectiveAccess.features.sri_configuration,
    canAccessSriInvoicing: effectiveAccess.features.sri_invoicing,
  };

  return {
    ...tenantMode,
    canUseAdvancedErp: canUseAdvancedErp(tenantMode),
  };
}
