import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getProducts } from "@/lib/core/inventory-products";
import { getWarehouses } from "@/lib/core/inventory-warehouses";
import { getBrands } from "@/lib/core/inventory-brands";
import { ProductsListClient } from "./products-list-client";

export default async function FacturacionProductsPage() {
  const { tenant } = await requireDashboardSession();
  const [productsResult, warehouses, brands] = await Promise.all([
    getProducts(tenant.id, { take: 50 }),
    getWarehouses(tenant.id),
    getBrands(tenant.id),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">Productos</h1>
        </div>
        <ProductsListClient
          initialProducts={JSON.parse(JSON.stringify(productsResult.items))}
          initialTotal={productsResult.total}
          warehouses={JSON.parse(JSON.stringify(warehouses))}
          brands={JSON.parse(JSON.stringify(brands))}
        />
      </div>
    </DashboardShell>
  );
}
