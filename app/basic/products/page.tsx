import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { ProductForm } from "@/components/appsolux/basic/product-form";
import { ProductInventory } from "@/components/appsolux/basic/product-inventory";
import { BillingErpLockedCard } from "@/components/appsolux/billing/billing-erp-locked-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicUsageCounts, listProducts } from "@/lib/core/lightweight-pos";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicProductsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function BasicProductsPage({ searchParams }: BasicProductsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Productos"
        description="Catálogo ligero con precios, códigos y stock básico."
        activeHref={routes.basicProducts}
      >
        <p className="text-muted-foreground">Sesión requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const tenantMode = await getTenantModeState(tenant);
  const [products, counts] = await Promise.all([
    listProducts(tenant.id, { search: resolvedSearchParams.q, take: 50 }),
    getBasicUsageCounts(tenant.id),
  ]);
  const limitReached = counts.products >= tenantMode.operationalLimits.products;
  const usagePercent = Math.min(100, (counts.products / tenantMode.operationalLimits.products) * 100);

  return (
    <BasicModuleShell
      title="Productos"
      description="Catálogo ligero con precios, códigos y stock básico."
      activeHref={routes.basicProducts}
      action={
        <Button asChild size="sm" className="bg-[#004080] hover:bg-[#003060]">
          <Link href="#nuevo-producto">Nuevo producto</Link>
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Plan usage bar */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Productos registrados
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {counts.products} / {tenantMode.operationalLimits.products}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#004080] transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-xs text-slate-400">
            Modo Básico
          </span>
        </div>

        {/* Nuevo producto */}
        <Card id="nuevo-producto" className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-base text-slate-900">Nuevo producto</CardTitle>
            <p className="text-sm text-slate-500">
              Agrega precio, costo, stock inicial y código de barras.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {limitReached && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Llegaste al límite del plan básico.{" "}
                <Button asChild variant="link" className="h-auto p-0 text-amber-800 underline">
                  <Link href="/billing">Ver opciones de plan</Link>
                </Button>
              </div>
            )}
            <ProductForm disabled={limitReached} />
          </CardContent>
        </Card>

        {/* Inventario básico */}
        <Card id="catalogo" className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-base text-slate-900">Inventario básico</CardTitle>
            <p className="text-sm text-slate-500">
              Busca, edita y ajusta stock producto por producto.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <form className="flex gap-2">
              <Input
                name="q"
                defaultValue={resolvedSearchParams.q ?? ""}
                placeholder="Buscar por nombre o código"
                className="rounded-2xl border-slate-200"
              />
              <Button type="submit" variant="outline">Buscar</Button>
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

        {/* ERP locked features */}
        <BillingErpLockedCard />

      </div>
    </BasicModuleShell>
  );
}
