import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { InventorySection, InventoryStatusBadge } from "@/components/appsolux/basic/inventory-ui";
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
  const inventoryNavigation = [
    { title: "Dashboard", href: routes.basicStock },
    { title: "Productos", href: routes.basicProducts },
    { title: "Reportes", href: routes.basicReports },
    { title: "Ventas", href: routes.basicSales },
  ];

  if (!user) {
    return (
      <BasicModuleShell
        title="Productos"
        description="Agrega productos para comenzar a vender y controla stock minimo."
        activeHref={routes.basicProducts}
        appName="Inventario"
        appDescription="Catalogo, ajustes y niveles minimos para una operacion ordenada."
        badge="App"
        badgeVariant="blue"
        navItems={inventoryNavigation}
        action={
          <Button asChild>
            <Link href={routes.basicStock}>Ver dashboard</Link>
          </Button>
        }
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
      appName="Inventario"
      appDescription="Catalogo, ajustes y niveles minimos para una operacion ordenada."
      badge="App"
      badgeVariant="blue"
      navItems={inventoryNavigation}
      action={
        <Button asChild>
          <Link href={routes.basicStock}>Ver dashboard</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="rounded-[28px] border border-sky-100 bg-linear-to-br from-sky-50 via-white to-slate-50 px-6 py-5">
          <InventorySection
            title="Catalogo de productos"
            description="Desde aqui puedes crear productos y ajustar stock sin salir de Inventario."
            action={<InventoryStatusBadge label={`${counts.products} / ${plan.limits.products} del plan`} variant="info" />}
          />
        </div>

        <Card id="nuevo-producto" className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
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

        <Card id="catalogo" className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
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
