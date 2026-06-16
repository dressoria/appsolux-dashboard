import "@/lib/security/server-only";

import type { OperatingMode } from "../../node_modules/.prisma/client";

type AdvancedErpAccessInput = {
  isSuspended: boolean;
  effectiveOperatingMode: OperatingMode;
  canAccessAdvancedInventory: boolean;
  canAccessAdvancedReports: boolean;
  effectiveFeatures: {
    shared_erp: boolean;
    dedicated_erp: boolean;
  };
};

export function canUseAdvancedErp(tenantMode: AdvancedErpAccessInput) {
  if (tenantMode.isSuspended) {
    return false;
  }

  if (tenantMode.effectiveOperatingMode === "CORE") {
    return false;
  }

  return (
    tenantMode.canAccessAdvancedInventory ||
    tenantMode.canAccessAdvancedReports ||
    tenantMode.effectiveFeatures.shared_erp ||
    tenantMode.effectiveFeatures.dedicated_erp
  );
}
