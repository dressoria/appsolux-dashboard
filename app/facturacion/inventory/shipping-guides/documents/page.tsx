import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getShipmentGuides } from "@/lib/core/inventory-guides";
import { ShipmentGuidesClient } from "./shipment-guides-client";

export default async function FacturacionInventoryShipmentGuidesPage() {
  const { tenant } = await requireDashboardSession();
  const result = await getShipmentGuides(tenant.id, { take: 50 });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario / Guías de remisión</p>
          <h1 className="text-3xl font-semibold tracking-tight">Documentos guía</h1>
        </div>
        <ShipmentGuidesClient
          initialGuides={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
        />
      </div>
    </DashboardShell>
  );
}
