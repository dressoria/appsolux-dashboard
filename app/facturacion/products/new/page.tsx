import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { getBrands } from "@/lib/core/inventory-brands";
import { getUnits } from "@/lib/core/inventory-units";
import { getPrismaClient } from "@/lib/db/prisma";
import { ProductFormClient } from "../product-form-client";

export default async function NewProductPage() {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();

  const [warehouses, brands, units, categories] = await Promise.all([
    getWarehouses(tenant.id),
    getBrands(tenant.id),
    getUnits(tenant.id),
    prisma.lightweightProductCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <DashboardShell>
      <ProductFormClient
        mode="create"
        warehouses={JSON.parse(JSON.stringify(warehouses))}
        brands={JSON.parse(JSON.stringify(brands))}
        units={JSON.parse(JSON.stringify(units))}
        categories={JSON.parse(JSON.stringify(categories))}
      />
    </DashboardShell>
  );
}
