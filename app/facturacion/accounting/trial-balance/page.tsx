import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { TrialBalanceClient } from "./trial-balance-client";

export default async function TrialBalancePage() {
  await requireDashboardSession();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad › Reportes contables</p>
          <h1 className="text-3xl font-semibold tracking-tight">Balance de comprobación</h1>
        </div>
        <TrialBalanceClient />
      </div>
    </DashboardShell>
  );
}
