import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getMovements } from "@/lib/core/inventory-movements";
import { MovementsClient } from "./movements-client";

export default async function FacturacionInventoryMovementsPage() {
  const { tenant } = await requireDashboardSession();
  const result = await getMovements(tenant.id, { take: 50 });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Movimientos</h1>
        </div>
        <MovementsClient
          initialMovements={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
        />
      </div>
    </DashboardShell>
  );
}
