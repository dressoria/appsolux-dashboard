import { Boxes, PackageCheck, TriangleAlert } from "lucide-react";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { ProductCatalog } from "@/components/appsolux/basic/product-catalog";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicUsageCounts, listProducts } from "@/lib/core/lightweight-pos";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getPrismaClient } from "@/lib/db/prisma";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function BasicProductsPage(_props?: { searchParams?: Promise<{ q?: string }> }) {
  void _props;
  const user = await getCurrentUser();
  if (!user) return <BasicModuleShell title="Productos" description="Catálogo comercial" activeHref={routes.basicProducts}><p>Sesión requerida.</p></BasicModuleShell>;
  const tenant = await getCurrentTenant(user);
  const [products, categories, counts, mode] = await Promise.all([
    listProducts(tenant.id, { take: 50 }),
    getPrismaClient().lightweightProductCategory.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } }),
    getBasicUsageCounts(tenant.id),
    getTenantModeState(tenant),
  ]);
  const withVat = products.filter((product) => Number(product.taxRate) > 0).length;
  const low = products.filter((product) => product.trackInventory && product.stock <= (product.minStock ?? 0)).length;
  return <BasicModuleShell title="Productos y servicios" description="Administra tu catálogo, precios, impuestos e inventario básico." activeHref={routes.basicProducts}>
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Boxes className="h-5 w-5"/>} label="Catálogo" value={`${counts.products} / ${mode.operationalLimits.products}`}/>
        <Metric icon={<PackageCheck className="h-5 w-5"/>} label="Con IVA" value={String(withVat)}/>
        <Metric icon={<TriangleAlert className="h-5 w-5"/>} label="Stock bajo o agotado" value={String(low)}/>
      </div>
      <ProductCatalog limitReached={counts.products >= mode.operationalLimits.products} categories={categories} products={products.map((product) => ({
        id: product.id, name: product.name, type: product.type, primaryCode: product.primaryCode, auxiliaryCode: product.auxiliaryCode,
        barcode: product.barcode, description: product.description, price: product.price.toString(), price2: product.price2?.toString() ?? null,
        price3: product.price3?.toString() ?? null, cost: product.cost?.toString() ?? null, stock: product.stock, minStock: product.minStock,
        expiresAt: product.expiresAt?.toISOString() ?? null, taxRate: product.taxRate.toString(), isActive: product.isActive,
        trackInventory: product.trackInventory, unit: product.unit, categoryId: product.categoryId, categoryName: product.category?.name ?? null,
        iceEnabled: product.iceEnabled, iceCode: product.iceCode, iceRate: product.iceRate?.toString() ?? null,
        comboItems: product.comboItems.map((item) => ({ componentProductId: item.componentProductId, quantity: item.quantity })),
      }))}/>
    </div>
  </BasicModuleShell>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">{icon}</span><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="text-2xl font-black text-slate-950">{value}</p></div></div></div>; }
