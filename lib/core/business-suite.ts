import "@/lib/security/server-only";

import type {
  BusinessSuiteAccessMode,
  BusinessSuitePlanMode,
  BusinessSuiteStatus,
  OperatingMode,
  TenantBillingMode,
  TenantOperationalStatus,
  TenantSubscriptionStatus,
} from "../../node_modules/.prisma/client";

export type BusinessSuiteSnapshot = {
  publicPlan: BusinessSuitePlanMode;
  businessSuiteMode: BusinessSuiteAccessMode;
  businessSuiteStatus: BusinessSuiteStatus;
  billingMode: TenantBillingMode;
  subscriptionStatus: TenantSubscriptionStatus;
};

export function mapOperatingModeToBusinessSuiteMode(
  operatingMode: OperatingMode
): BusinessSuiteAccessMode {
  if (operatingMode === "SHARED_ERP") {
    return "shared";
  }

  if (operatingMode === "DEDICATED_ERP") {
    return "dedicated";
  }

  return "none";
}

export function mapBusinessSuiteModeToOperatingMode(
  mode: BusinessSuiteAccessMode
): OperatingMode {
  if (mode === "shared") {
    return "SHARED_ERP";
  }

  if (mode === "dedicated") {
    return "DEDICATED_ERP";
  }

  return "CORE";
}

export function derivePublicPlan(input: {
  configuredOperatingMode: OperatingMode;
  effectiveOperatingMode: OperatingMode;
  canRequestDedicatedErp: boolean;
}): BusinessSuitePlanMode {
  const activeMode =
    input.effectiveOperatingMode !== "CORE"
      ? input.effectiveOperatingMode
      : input.configuredOperatingMode;

  if (activeMode === "DEDICATED_ERP" || input.canRequestDedicatedErp) {
    return "business_dedicated";
  }

  if (activeMode === "SHARED_ERP") {
    return "business_shared";
  }

  return "basic";
}

export function normalizeBillingMode(input: {
  billingMode: TenantBillingMode | null | undefined;
  subscriptionStatus: TenantSubscriptionStatus;
}): TenantBillingMode {
  if (input.billingMode) {
    return input.billingMode;
  }

  if (input.subscriptionStatus === "trialing") {
    return "trial";
  }

  return "manual";
}

export function resolveBusinessSuiteStatus(input: {
  configuredOperatingMode: OperatingMode;
  operationalStatus: TenantOperationalStatus;
  configuredStatus: BusinessSuiteStatus | null | undefined;
  sharedErpEnabled: boolean;
  dedicatedErpEnabled: boolean;
  hasRealDedicatedErp: boolean;
}): BusinessSuiteStatus {
  if (
    input.operationalStatus === "suspended" ||
    input.operationalStatus === "disabled"
  ) {
    return "suspended";
  }

  if (input.configuredOperatingMode === "CORE") {
    return "locked";
  }

  if (input.configuredStatus && input.configuredStatus !== "locked") {
    return input.configuredStatus;
  }

  if (input.configuredOperatingMode === "SHARED_ERP") {
    return input.sharedErpEnabled ? "active" : "pending_migration";
  }

  if (input.dedicatedErpEnabled && input.hasRealDedicatedErp) {
    return "active";
  }

  if (input.dedicatedErpEnabled) {
    return "migrating";
  }

  return "pending_migration";
}

export function canUseBusinessSuite(status: BusinessSuiteStatus) {
  return status === "active";
}
