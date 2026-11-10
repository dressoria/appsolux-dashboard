import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getProducts } from "@/lib/core/inventory-products";
import { sanitizePage, sanitizePerPage } from "@/lib/pagination";
import { ProductsListClient } from "./products-list-client";

export default async function FacturacionProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string; perPage?: string; status?: string; saved?: string }> }) {
  const { tenant } = await requireDashboardSession();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = ["PRODUCT", "SERVICE", "COMBO"].includes(params.type ?? "") ? params.type! : "";
  const status = params.status === "inactive" ? "inactive" : params.status === "all" ? "all" : "active";
  const page = sanitizePage(params.page);
  const perPage = sanitizePerPage(params.perPage);
  const productsResult = await getProducts(tenant.id, {
    take: perPage,
    skip: (page - 1) * perPage,
    q,
    type: type || undefined,
    isActive: status === "all" ? undefined : status === "active",
  });

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
          status={status}
          page={page}
          perPage={perPage}
          saved={params.saved === "created" || params.saved === "updated" ? params.saved : undefined}
        />
      </div>
    </DashboardShell>
  );
}
