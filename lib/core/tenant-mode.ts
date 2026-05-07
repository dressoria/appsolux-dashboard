import "@/lib/security/server-only";

import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getTenantPlanState } from "@/lib/core/plans";
import type { AppsoluxTenant } from "@/types/tenant";

export async function getTenantModeState(tenant: AppsoluxTenant) {
  const [plan, erp] = await Promise.all([
    getTenantPlanState(tenant.id),
    getErpProvisioningState(tenant),
  ]);
  const hasDedicatedErp = erp.isRealActive;
  const shouldUseAdvancedMode = hasDedicatedErp;
  const shouldUseBasicMode = !shouldUseAdvancedMode;

  return {
    planKey: plan.planKey,
    planName: plan.planName,
    subscriptionStatus: plan.status,
    trialEndsAt: plan.trialEndsAt,
    currentPeriodEndsAt: plan.currentPeriodEndsAt,
    limits: plan.limits,
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
      ? "Solicitar ERP dedicado"
      : "Mejorar plan para activar ERP dedicado",
    upgradeCtaHref: "/billing",
  };
}
