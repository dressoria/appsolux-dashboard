import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getValuation } from "@/lib/core/inventory-valuation";
import { ValuationClient } from "./valuation-client";

export default async function FacturacionInventoryValuationPage() {
  const { tenant } = await requireDashboardSession();
  const result = await getValuation(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Valoración</h1>
        </div>
        <ValuationClient
          initialItems={JSON.parse(JSON.stringify(result.rows))}
          totalValue={result.totalValue.toString()}
          method={result.method}
        />
      </div>
    </DashboardShell>
  );
}
