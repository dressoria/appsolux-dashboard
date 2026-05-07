import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { ProductForm } from "@/components/appsolux/basic/product-form";
import { ProductInventory } from "@/components/appsolux/basic/product-inventory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicUsageCounts, listProducts } from "@/lib/core/lightweight-pos";
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
      <BasicModuleShell
        title="Productos"
        description="Agrega productos para comenzar a vender y controla stock minimo."
        activeHref={routes.basicProducts}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const plan = await getTenantPlanState(tenant.id);
  const [products, counts] = await Promise.all([
    listProducts(tenant.id, {
      search: resolvedSearchParams.q,
      take: 50,
    }),
    getBasicUsageCounts(tenant.id),
  ]);
  const limitReached = counts.products >= plan.limits.products;

  return (
    <BasicModuleShell
      title="Productos"
      description="Catalogo ligero con precios, codigos, stock minimo y ajustes manuales."
      activeHref={routes.basicProducts}
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {counts.products} / {plan.limits.products} productos del plan.
        </p>

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
    </BasicModuleShell>
  );
}
