import Link from "next/link";

import { ProductForm } from "@/components/appsolux/basic/product-form";
import { ProductInventory } from "@/components/appsolux/basic/product-inventory";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listProducts } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicProductsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function BasicProductsPage({
  searchParams,
}: BasicProductsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const plan = await getTenantPlanState(tenant.id);
  const products = await listProducts(tenant.id, {
    search: resolvedSearchParams.q,
  });
  const allProducts = await listProducts(tenant.id);
  const limitReached = allProducts.length >= plan.limits.products;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-2 text-muted-foreground">
            {allProducts.length} / {plan.limits.products} productos del plan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo producto</CardTitle>
          </CardHeader>
          <CardContent>
            {limitReached ? (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Llegaste al limite de tu plan actual.{" "}
                <Button asChild variant="link" className="h-auto p-0">
                  <Link href="/billing">Mejorar plan</Link>
                </Button>
              </div>
            ) : null}
            <ProductForm disabled={limitReached} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario basico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <form className="mb-4 flex gap-2">
              <Input
                name="q"
                defaultValue={resolvedSearchParams.q ?? ""}
                placeholder="Buscar por nombre o codigo"
              />
              <Button type="submit">Buscar</Button>
            </form>
            <ProductInventory
              products={products.map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price.toString(),
                cost: product.cost?.toString() ?? null,
                stock: product.stock,
                minStock: product.minStock,
                barcode: product.barcode,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
