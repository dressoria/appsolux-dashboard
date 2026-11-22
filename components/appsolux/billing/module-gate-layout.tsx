import type { ReactNode } from "react";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import {
  checkModuleAccess,
  getTenantCommercialPlan,
  type ModuleKey,
} from "@/lib/core/capabilities";

import { PlanGatePrompt } from "./plan-gate";

export async function ModuleGateLayout({
  moduleKey,
  tenantId,
  children,
}: {
  moduleKey: ModuleKey;
  tenantId: string;
  children: ReactNode;
}) {
  const commercialPlan = await getTenantCommercialPlan(tenantId);
  const access = checkModuleAccess(commercialPlan, moduleKey);

  if (access.allowed) {
    return <>{children}</>;
  }

  return (
    <DashboardShell>
      <PlanGatePrompt
        moduleName={access.moduleName}
        moduleDescription={access.moduleDescription}
        requiredPlanName={access.requiredPlanName}
      />
    </DashboardShell>
  );
}
