import "@/lib/security/server-only";

import type { CommercialPlan, FeatureKey, OperatingMode } from "../../node_modules/.prisma/client";

export type LegacyPlanKey = "free" | "trial" | "pro" | "enterprise";
export type TenantFeatureMap = Record<FeatureKey, boolean>;

export const allTenantFeatureKeys = [
  "inventory_basic",
  "pos_basic",
  "sales_basic",
  "customers_basic",
  "reports_basic",
  "sri_invoicing",
  "sri_configuration",
  "inventory_advanced",
  "purchases",
  "warehouses",
  "kardex",
  "advanced_reports",
  "shared_erp",
  "dedicated_erp",
  "erp_provisioning",
  "admin_access",
  "beta_access",
] as const satisfies readonly FeatureKey[];

function buildFeatureMap(enabledKeys: readonly FeatureKey[]): TenantFeatureMap {
  return Object.fromEntries(
    allTenantFeatureKeys.map((featureKey) => [featureKey, enabledKeys.includes(featureKey)])
  ) as TenantFeatureMap;
}

export function mapLegacyPlanKeyToCommercialPlan(planKey: string | null | undefined): CommercialPlan {
  if (planKey === "enterprise") {
    return "ENTERPRISE";
  }

  if (planKey === "pro") {
    return "PLUS";
  }

  if (planKey === "trial") {
    return "PLUS";
  }

  return "BASIC";
}

export function getDefaultOperatingModeForPlan(plan: CommercialPlan): OperatingMode {
  if (plan === "ADVANCED") {
    return "SHARED_ERP";
  }

  if (plan === "ENTERPRISE") {
    return "DEDICATED_ERP";
  }

  return "CORE";
}

export function getDefaultFeaturesForPlan(plan: CommercialPlan): TenantFeatureMap {
  switch (plan) {
    case "PLUS":
      return buildFeatureMap([
        "inventory_basic",
        "pos_basic",
        "sales_basic",
        "customers_basic",
        "reports_basic",
        "sri_invoicing",
        "sri_configuration",
      ]);
    case "ADVANCED":
      return buildFeatureMap([
        "inventory_basic",
        "pos_basic",
        "sales_basic",
        "customers_basic",
        "reports_basic",
        "sri_invoicing",
        "sri_configuration",
        "inventory_advanced",
        "purchases",
        "warehouses",
        "kardex",
        "advanced_reports",
        "shared_erp",
      ]);
    case "ENTERPRISE":
      return buildFeatureMap([
        "inventory_basic",
        "pos_basic",
        "sales_basic",
        "customers_basic",
        "reports_basic",
        "sri_invoicing",
        "sri_configuration",
        "inventory_advanced",
        "purchases",
        "warehouses",
        "kardex",
        "advanced_reports",
        "shared_erp",
        "dedicated_erp",
        "erp_provisioning",
        "beta_access",
      ]);
    case "BASIC":
    default:
      return buildFeatureMap([
        "inventory_basic",
        "pos_basic",
        "sales_basic",
        "customers_basic",
        "reports_basic",
      ]);
  }
}

export function getDefaultFeaturesForOperatingMode(mode: OperatingMode): TenantFeatureMap {
  switch (mode) {
    case "SHARED_ERP":
      return buildFeatureMap([
        "inventory_advanced",
        "purchases",
        "warehouses",
        "kardex",
        "advanced_reports",
        "shared_erp",
      ]);
    case "DEDICATED_ERP":
      return buildFeatureMap([
        "inventory_advanced",
        "purchases",
        "warehouses",
        "kardex",
        "advanced_reports",
        "shared_erp",
        "dedicated_erp",
        "erp_provisioning",
      ]);
    case "CORE":
    default:
      return buildFeatureMap([
        "inventory_basic",
        "pos_basic",
        "sales_basic",
        "customers_basic",
        "reports_basic",
      ]);
  }
}
