import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";
import { SettingsCategoriesClient } from "./settings-categories-client";

export default async function FacturacionInventorySettingsCategoriesPage() {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const categories = await prisma.lightweightProductCategory.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario / Configuración</p>
          <h1 className="text-3xl font-semibold tracking-tight">Categorías</h1>
        </div>
        <SettingsCategoriesClient initialCategories={JSON.parse(JSON.stringify(categories))} />
      </div>
    </DashboardShell>
  );
}
