import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTransfers } from "@/lib/core/inventory-transfers";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { getPrismaClient } from "@/lib/db/prisma";
import { TransfersClient } from "./transfers-client";

export default async function FacturacionInventoryTransfersPage() {
  const { tenant } = await requireDashboardSession();
  const [result, warehouses, products] = await Promise.all([
    getTransfers(tenant.id, { take: 50 }),
    getWarehouses(tenant.id),
    getPrismaClient().lightweightProduct.findMany({
      where: { tenantId: tenant.id, isActive: true, type: "PRODUCT" },
      select: { id: true, name: true, primaryCode: true, stock: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-[#667085]">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#172033]">Transferencias</h1>
        </div>
        <TransfersClient
          initialTransfers={JSON.parse(JSON.stringify(result.items))}
          initialTotal={result.total}
          warehouses={warehouses.filter((w) => w.active).map((w) => ({ id: w.id, name: w.name }))}
          products={products.map((p) => ({ id: p.id, name: p.name, primaryCode: p.primaryCode, stock: p.stock }))}
        />
      </div>
    </DashboardShell>
  );
}
