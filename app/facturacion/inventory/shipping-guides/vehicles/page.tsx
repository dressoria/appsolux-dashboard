import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getVehicles } from "@/lib/core/inventory-guides";
import { VehiclesClient } from "./vehicles-client";

export default async function FacturacionInventoryVehiclesPage() {
  const { tenant } = await requireDashboardSession();
  const vehicles = await getVehicles(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario / Guías de remisión</p>
          <h1 className="text-3xl font-semibold tracking-tight">Vehículos</h1>
        </div>
        <VehiclesClient initialVehicles={JSON.parse(JSON.stringify(vehicles))} />
      </div>
    </DashboardShell>
  );
}
