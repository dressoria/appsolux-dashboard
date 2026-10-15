import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getCostCenters } from "@/lib/core/accounting-cost-centers";
import { CostCentersClient } from "./cost-centers-client";

export default async function CostCentersPage() {
  const { tenant } = await requireDashboardSession();
  const centers = await getCostCenters(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Centros de costo</h1>
        </div>
        <CostCentersClient initialCenters={JSON.parse(JSON.stringify(centers))} />
      </div>
    </DashboardShell>
  );
}
