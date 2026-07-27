import Link from "next/link";
import { BarChart3, Boxes, PackagePlus, ShieldCheck } from "lucide-react";

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
  const lowStockCount = products.filter(
    (product) =>
      product.minStock !== null &&
      product.minStock !== undefined &&
      product.stock > 0 &&
      product.stock <= product.minStock
  ).length;
  const taxEnabledCount = products.filter((product) => Number(product.taxRate.toString()) > 0).length;

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
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Productos registrados
                </p>
                <p className="mt-2 text-3xl font-black text-slate-950">
                  {counts.products} / {tenantMode.operationalLimits.products}
                </p>
                <p className="mt-1 text-sm text-slate-500">Modo básico activo para tu catálogo principal.</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#588100] text-white">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#588100] to-[#8db600] transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <BarChart3 className="h-4.5 w-4.5" />
              </div>
              <p className="mt-4 text-sm text-slate-500">Stock bajo</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{lowStockCount}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <p className="mt-4 text-sm text-slate-500">Con IVA</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{taxEnabledCount}</p>
            </div>
          </div>
        </div>

        <Card id="nuevo-producto" className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-6 pt-6 pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#588100] text-white">
                <PackagePlus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-900">Nuevo producto</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Agrega precio, costo, stock inicial y datos de catálogo con mejor organización.
                </p>
              </div>
            </div>
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

        <Card id="catalogo" className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-6 pt-6 pb-3">
            <CardTitle className="text-lg text-slate-900">Inventario básico</CardTitle>
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
                taxRate: product.taxRate.toString(),
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
