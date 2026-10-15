import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { AdjustmentsClient } from "./adjustments-client";

export default async function FacturacionInventoryAdjustmentsPage() {
  const { tenant } = await requireDashboardSession();
  const warehouses = await getWarehouses(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Ajustes de inventario</h1>
        </div>
        <AdjustmentsClient warehouses={JSON.parse(JSON.stringify(warehouses))} />
      </div>
    </DashboardShell>
  );
}
