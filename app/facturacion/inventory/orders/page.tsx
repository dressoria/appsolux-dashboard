import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getOrders } from "@/lib/core/inventory-orders";
import { OrdersClient } from "./orders-client";

export default async function FacturacionInventoryOrdersPage() {
  const { tenant } = await requireDashboardSession();
  const result = await getOrders(tenant.id, { take: 50 });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Pedidos de reposición</h1>
        </div>
        <OrdersClient
          initialOrders={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
        />
      </div>
    </DashboardShell>
  );
}
