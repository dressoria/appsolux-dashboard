import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { WarehousesClient } from "./warehouses-client";

export default async function FacturacionInventoryWarehousesPage() {
  const { tenant } = await requireDashboardSession();
  const warehouses = await getWarehouses(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Bodegas</h1>
        </div>
        <WarehousesClient initialWarehouses={JSON.parse(JSON.stringify(warehouses))} />
      </div>
    </DashboardShell>
  );
}
