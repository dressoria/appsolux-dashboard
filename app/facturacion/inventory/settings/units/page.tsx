import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getUnits } from "@/lib/core/inventory-units";
import { SettingsUnitsClient } from "./settings-units-client";

export default async function FacturacionInventorySettingsUnitsPage() {
  const { tenant } = await requireDashboardSession();
  const units = await getUnits(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario / Configuración</p>
          <h1 className="text-3xl font-semibold tracking-tight">Unidades de medida</h1>
        </div>
        <SettingsUnitsClient initialUnits={JSON.parse(JSON.stringify(units))} />
      </div>
    </DashboardShell>
  );
}
