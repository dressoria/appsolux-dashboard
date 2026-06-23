import Link from "next/link";
import {
  Boxes,
  ChevronRight,
  LibraryBig,
  Package,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { CreateItemForm } from "@/components/appsolux/erp/create-item-form";
import { ProductPricingManager } from "@/components/appsolux/erp/product-pricing-manager";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getErpProductPricingMap } from "@/lib/core/erp-pricing";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

async function loadResource<T>(loader: () => Promise<T>, fallback: T) {
  try {
    return {
      data: await loader(),
      error: null as string | null,
    };
  } catch (error) {
    return {
      data: fallback,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con ERPNext.",
    };
  }
}

export default async function ErpInventoryProductsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver productos.</p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">
                Inventario
              </Link>{" "}
              / Productos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Productos</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver productos.</p>
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [itemsResult, mastersResult, inventoryResult] = await Promise.all([
    loadResource(getErpnextItems, []),
    loadResource(getErpnextMasters, {
      itemGroups: [],
      uoms: [],
      territories: [],
      companies: [],
    }),
    loadResource(getErpnextInventory, []),
  ]);
  const items = itemsResult.data;
  const pricingMap = await getErpProductPricingMap(
    tenant.id,
    items.map((item) => item.item_code)
  );
  const masters = mastersResult.data;
  const inventory = inventoryResult.data;
  const masterDataWarning = mastersResult.error
    ? `No se pudieron cargar categorías y unidades. ${mastersResult.error}`
    : null;

  const stockByItemCode = inventory.reduce<Record<string, number>>((acc, row) => {
    acc[row.item_code] = (acc[row.item_code] ?? 0) + (row.actual_qty ?? 0);
    return acc;
  }, {});
  const stockItemsCount = items.filter((item) => item.is_stock_item !== 0).length;
  const withoutStockCount = items.filter((item) => (stockByItemCode[item.item_code] ?? 0) <= 0).length;

  return (
    <DashboardShell contentClassName="mx-auto max-w-7xl">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50 shadow-sm shadow-sky-100/60">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-3 py-1 text-xs font-medium text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Catalogo ERP
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Link href={routes.erp} className="transition hover:text-slate-900">
                  ERP Comercial
                </Link>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <Link href={routes.erpInventory} className="transition hover:text-slate-900">
                  Inventario
                </Link>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <span className="text-slate-700">Productos</span>
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Productos</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Crea y organiza productos para ventas, compras e inventario.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
              <p className="text-sm font-semibold text-slate-900">Accesos utiles</p>
              <p className="mt-1 text-sm text-slate-500">
                Navega entre stock, kardex y el dashboard de inventario.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full border-slate-200">
                  <Link href={routes.erpInventoryStock}>Ver stock</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-slate-200">
                  <Link href={routes.erpInventoryKardex}>Ver kardex</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-slate-200">
                  <Link href={routes.erpInventory}>Volver a inventario</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[24px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Productos</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {items.length}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Registrados en ERP.</p>
                </div>
                <div className="rounded-2xl bg-sky-100 p-3 text-blue-600">
                  <Package className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Con stock</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {stockItemsCount}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Manejan inventario en ERP.
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-100 p-3 text-blue-600">
                  <Boxes className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Categorias</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {masters.itemGroups.length}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Disponibles para clasificar.
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-100 p-3 text-blue-600">
                  <LibraryBig className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Sin existencias</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {withoutStockCount}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Segun stock visible por item.
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <CreateItemForm
          itemGroups={masters.itemGroups}
          uoms={masters.uoms}
          masterDataWarning={masterDataWarning}
        />

        <ProductPricingManager items={items} pricingMap={pricingMap} />

        <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-slate-900">Productos registrados</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Revisa codigo, categoria, unidad y existencias visibles.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href={routes.erpInventoryCategories}>Gestionar categorias</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href={routes.erpInventoryUnits}>Gestionar unidades</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            {itemsResult.error || inventoryResult.error ? (
              <div className="mb-5 rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
                <p className="font-medium">Algunos datos no se pudieron cargar desde ERPNext.</p>
                <div className="mt-1 space-y-1 leading-6">
                  {itemsResult.error ? <p>Productos: {itemsResult.error}</p> : null}
                  {inventoryResult.error ? <p>Inventario: {inventoryResult.error}</p> : null}
                </div>
              </div>
            ) : null}

            {items.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-blue-600">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Aun no hay productos</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Usa el formulario superior para crear el primer producto sin salir de esta pantalla.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="py-3 pr-4 font-medium">Codigo</th>
                      <th className="py-3 pr-4 font-medium">Nombre</th>
                      <th className="py-3 pr-4 font-medium">Categoria</th>
                      <th className="py-3 pr-4 font-medium">Unidad</th>
                      <th className="py-3 pr-4 font-medium">Stock visible</th>
                      <th className="py-3 pr-4 font-medium">Inventario</th>
                      <th className="py-3 pr-4 font-medium">Estado</th>
                      <th className="py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const stock = stockByItemCode[item.item_code] ?? 0;

                      return (
                        <tr key={item.name} className="transition hover:bg-slate-50/80">
                          <td className="py-3 pr-4">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-600">
                              {item.item_code}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div>
                              <p className="font-medium text-slate-900">{item.item_name}</p>
                              <p className="text-xs text-slate-500">{item.name}</p>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{item.item_group ?? "-"}</td>
                          <td className="py-3 pr-4 text-slate-600">{item.stock_uom ?? "-"}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                stock <= 0
                                  ? "border border-amber-200 bg-amber-50 text-amber-700"
                                  : "border border-sky-200 bg-sky-50 text-blue-700"
                              }`}
                            >
                              {stock.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {item.is_stock_item !== 0 ? (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Maneja stock
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                                Sin stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {item.disabled === 1 ? (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                                Inactivo
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Activo
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`${routes.erpInventoryKardex}?item=${encodeURIComponent(item.item_code)}`}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Ver kardex
                              </Link>
                              <Link
                                href={`${routes.erpInventoryStock}?item=${encodeURIComponent(item.item_code)}`}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Ver stock
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
