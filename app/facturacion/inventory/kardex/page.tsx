import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { getPrismaClient } from "@/lib/db/prisma";
import { KardexClient } from "./kardex-client";

export default async function FacturacionInventoryKardexPage() {
  const { tenant } = await requireDashboardSession();
  const [warehouses, products] = await Promise.all([
    getWarehouses(tenant.id),
    getPrismaClient().lightweightProduct.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true, primaryCode: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-[#667085]">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#172033]">Kardex</h1>
        </div>
        <KardexClient
          products={products.map((p) => ({ id: p.id, name: p.name, primaryCode: p.primaryCode }))}
          warehouses={warehouses.filter((w) => w.active).map((w) => ({ id: w.id, name: w.name }))}
        />
      </div>
    </DashboardShell>
  );
}
