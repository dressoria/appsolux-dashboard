import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTransfers } from "@/lib/core/inventory-transfers";
import { TransfersClient } from "./transfers-client";

export default async function FacturacionInventoryTransfersPage() {
  const { tenant } = await requireDashboardSession();
  const result = await getTransfers(tenant.id, { take: 50 });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Transferencias</h1>
        </div>
        <TransfersClient
          initialTransfers={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
        />
      </div>
    </DashboardShell>
  );
}
