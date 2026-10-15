import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getBrands } from "@/lib/core/inventory-brands";
import { SettingsBrandsClient } from "./settings-brands-client";

export default async function FacturacionInventorySettingsBrandsPage() {
  const { tenant } = await requireDashboardSession();
  const brands = await getBrands(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario / Configuración</p>
          <h1 className="text-3xl font-semibold tracking-tight">Marcas</h1>
        </div>
        <SettingsBrandsClient initialBrands={JSON.parse(JSON.stringify(brands))} />
      </div>
    </DashboardShell>
  );
}
