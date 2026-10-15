import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getVehicles } from "@/lib/core/inventory-guides";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { NewShipmentGuideClient } from "./new-shipment-guide-client";

export default async function FacturacionInventoryNewShipmentGuidePage() {
  const { tenant } = await requireDashboardSession();
  const [vehicles, warehouses] = await Promise.all([
    getVehicles(tenant.id),
    getWarehouses(tenant.id),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario / Guías de remisión</p>
          <h1 className="text-3xl font-semibold tracking-tight">Nueva guía de remisión</h1>
        </div>
        <NewShipmentGuideClient
          vehicles={JSON.parse(JSON.stringify(vehicles))}
          warehouses={JSON.parse(JSON.stringify(warehouses))}
        />
      </div>
    </DashboardShell>
  );
}
