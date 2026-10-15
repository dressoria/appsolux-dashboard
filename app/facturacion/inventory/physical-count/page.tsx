import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPhysicalCounts } from "@/lib/core/inventory-physical-counts";
import { PhysicalCountClient } from "./physical-count-client";

export default async function FacturacionInventoryPhysicalCountPage() {
  const { tenant } = await requireDashboardSession();
  const result = await getPhysicalCounts(tenant.id, { take: 50 });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Toma física</h1>
        </div>
        <PhysicalCountClient
          initialCounts={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
        />
      </div>
    </DashboardShell>
  );
}
