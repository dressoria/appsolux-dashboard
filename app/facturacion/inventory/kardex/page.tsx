import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { KardexClient } from "./kardex-client";

export default async function FacturacionInventoryKardexPage() {
  await requireDashboardSession();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Kardex</h1>
        </div>
        <KardexClient />
      </div>
    </DashboardShell>
  );
}
