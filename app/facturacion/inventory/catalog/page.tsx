import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getInventorySettings } from "@/lib/core/inventory-settings";
import { CatalogClient } from "./catalog-client";

export default async function FacturacionInventoryCatalogPage() {
  const { tenant } = await requireDashboardSession();
  const settings = await getInventorySettings(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Catálogo PDF</h1>
        </div>
        <CatalogClient settings={settings ? JSON.parse(JSON.stringify(settings)) : null} />
      </div>
    </DashboardShell>
  );
}
