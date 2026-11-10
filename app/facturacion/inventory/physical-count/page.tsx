import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPhysicalCounts } from "@/lib/core/inventory-physical-counts";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { PhysicalCountClient } from "./physical-count-client";

export default async function FacturacionInventoryPhysicalCountPage() {
  const { tenant } = await requireDashboardSession();
  const [result, warehouses] = await Promise.all([
    getPhysicalCounts(tenant.id, { take: 50 }),
    getWarehouses(tenant.id),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-[#667085]">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#172033]">Toma física</h1>
        </div>
        <PhysicalCountClient
          initialCounts={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
          warehouses={warehouses.filter((w) => w.active).map((w) => ({ id: w.id, name: w.name }))}
        />
      </div>
    </DashboardShell>
  );
}
