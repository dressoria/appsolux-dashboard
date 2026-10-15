import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPeriods } from "@/lib/core/accounting-periods";
import { PeriodsClient } from "./periods-client";

export default async function PeriodsPage() {
  const { tenant } = await requireDashboardSession();
  const periods = await getPeriods(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Períodos contables</h1>
        </div>
        <PeriodsClient initialPeriods={JSON.parse(JSON.stringify(periods))} />
      </div>
    </DashboardShell>
  );
}
