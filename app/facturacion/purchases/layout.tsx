import type { ReactNode } from "react";

import { ModuleGateLayout } from "@/components/appsolux/billing/module-gate-layout";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export default async function PurchasesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { tenant } = await requireDashboardSession();

  return (
    <ModuleGateLayout moduleKey="purchases" tenantId={tenant.id}>
      {children}
    </ModuleGateLayout>
  );
}
