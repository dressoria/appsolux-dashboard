import type { ReactNode } from "react";

import { ModuleGateLayout } from "@/components/appsolux/billing/module-gate-layout";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export default async function SuppliersLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { tenant } = await requireDashboardSession();

  return (
    <ModuleGateLayout moduleKey="suppliers" tenantId={tenant.id}>
      {children}
    </ModuleGateLayout>
  );
}
