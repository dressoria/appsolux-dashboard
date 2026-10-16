import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getProducts } from "@/lib/core/inventory-products";
import { ProductsListClient } from "./products-list-client";

export default async function FacturacionProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string; saved?: string }> }) {
  const { tenant } = await requireDashboardSession();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = ["PRODUCT", "SERVICE", "COMBO"].includes(params.type ?? "") ? params.type! : "";
  const page = Math.max(1, Math.min(1000000, Math.floor(Number(params.page) || 1)));
  const productsResult = await getProducts(tenant.id, { take: 50, skip: (page - 1) * 50, q, type: type || undefined });

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
          q={q}
          type={type}
          page={page}
          saved={params.saved === "created" || params.saved === "updated" ? params.saved : undefined}
        />
      </div>
    </DashboardShell>
  );
}
