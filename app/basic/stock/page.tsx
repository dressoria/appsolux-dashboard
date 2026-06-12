import Link from "next/link";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CircleAlert,
  PackagePlus,
  ScanSearch,
  ScrollText,
  ShoppingBag,
} from "lucide-react";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import {
  InventoryMetricCard,
  InventoryQuickAction,
  InventorySection,
  InventoryStatusBadge,
} from "@/components/appsolux/basic/inventory-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicReports, listProducts, listStockMovements } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicStockPageProps = {
  searchParams: Promise<{
    productId?: string;
    type?: string;
  }>;
};

export default async function BasicStockPage({ searchParams }: BasicStockPageProps) {
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
        title="Inventario"
        description="Controla productos, stock, movimientos y alertas."
        activeHref={routes.basicStock}
        appName="Inventario"
        appDescription="Controla productos, stock, movimientos y alertas desde una app dedicada."
        badge="App"
        badgeVariant="blue"
        navItems={inventoryNavigation}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={routes.basicProducts}>Agregar producto</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${routes.basicProducts}#catalogo`}>Registrar movimiento</Link>
            </Button>
          </div>
        }
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const type =
    resolvedSearchParams.type === "sale" ||
    resolvedSearchParams.type === "adjustment"
      ? resolvedSearchParams.type
      : undefined;
  const [products, movements, reports] = await Promise.all([
    listProducts(tenant.id, { take: 50 }),
    listStockMovements(tenant.id, {
      productId: resolvedSearchParams.productId,
      type,
      take: 50,
    }),
    getBasicReports(tenant.id),
  ]);
  const lowAndOutProducts = [...reports.outOfStockProducts, ...reports.lowStockProducts];
  const inventoryValue = products.reduce((total, product) => {
    const unitValue = Number(product.cost?.toString() ?? product.price.toString());
    return total + unitValue * product.stock;
  }, 0);
  const saleMovements = movements.filter((movement) => movement.type === "sale");
  const adjustmentMovements = movements.filter((movement) => movement.type === "adjustment");
  const latestProducts = products.slice(0, 4);
  const filteredLabel =
    type === "sale" ? "Mostrando solo salidas por venta." : type === "adjustment" ? "Mostrando solo ajustes manuales." : "Mostrando actividad reciente del inventario.";

  return (
    <BasicModuleShell
      title="Inventario"
      description="Controla productos, stock, movimientos y alertas."
      activeHref={routes.basicStock}
      appName="Inventario"
      appDescription="Controla productos, stock, movimientos y alertas desde una app dedicada."
      badge="App"
      badgeVariant="blue"
      navItems={inventoryNavigation}
      action={
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routes.basicProducts}>Agregar producto</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`${routes.basicProducts}#catalogo`}>Registrar movimiento</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-linear-to-br from-sky-100 via-white to-slate-50">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.95fr] lg:px-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                  App de Inventario
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Controla productos, stock, movimientos y alertas.
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Centraliza la operacion de inventario con una vista clara: catalogo, niveles de stock,
                  movimientos recientes y productos que requieren atencion.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InventoryMetricCard
                  icon={Boxes}
                  label="Productos activos"
                  value={String(reports.counts.products)}
                  helper="Total de productos registrados en modo basico."
                  tone="info"
                />
                <InventoryMetricCard
                  icon={CircleAlert}
                  label="Stock critico"
                  value={String(lowAndOutProducts.length)}
                  helper="Suma de productos agotados y con stock bajo."
                  tone="warning"
                />
                <InventoryMetricCard
                  icon={ShoppingBag}
                  label="Valor estimado"
                  value={`$${inventoryValue.toFixed(2)}`}
                  helper="Calculado con stock actual x costo o precio disponible."
                  tone="success"
                />
                <InventoryMetricCard
                  icon={ArrowDownToLine}
                  label="Movimientos"
                  value={String(adjustmentMovements.length)}
                  helper="Ajustes detectados en los ultimos 50 movimientos."
                />
                <InventoryMetricCard
                  icon={ArrowUpFromLine}
                  label="Salidas / ventas"
                  value={String(saleMovements.length)}
                  helper="Ventas registradas dentro de los ultimos 50 movimientos."
                />
                <InventoryMetricCard
                  icon={Activity}
                  label="Actividad reciente"
                  value={String(movements.length)}
                  helper="Registros visibles en esta vista segun filtro actual."
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
              <InventorySection
                title="Accesos rapidos"
                description="Atajos para las tareas mas comunes del inventario."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <InventoryQuickAction
                  title="Productos"
                  description="Crea, edita y revisa el catalogo."
                  href={routes.basicProducts}
                  icon={PackagePlus}
                />
                <InventoryQuickAction
                  title="Stock"
                  description="Vuelve al dashboard de niveles y alertas."
                  href={routes.basicStock}
                  icon={Boxes}
                />
                <InventoryQuickAction
                  title="Entradas / ajustes"
                  description="Filtra ajustes manuales y correcciones."
                  href={`${routes.basicStock}?type=adjustment`}
                  icon={ArrowDownToLine}
                />
                <InventoryQuickAction
                  title="Salidas / ventas"
                  description="Consulta movimientos descontados por ventas."
                  href={`${routes.basicStock}?type=sale`}
                  icon={ArrowUpFromLine}
                />
                <InventoryQuickAction
                  title="Movimientos"
                  description="Audita actividad reciente del inventario."
                  href={routes.basicStock}
                  icon={ScrollText}
                />
                <InventoryQuickAction
                  title="Reportes"
                  description="Revisa tendencias y productos top."
                  href={routes.basicReports}
                  icon={ScanSearch}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-slate-900">Stock critico</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Productos que necesitan reposicion o seguimiento inmediato.
                  </p>
                </div>
                <InventoryStatusBadge
                  label={lowAndOutProducts.length > 0 ? "Revisar hoy" : "Estable"}
                  variant={lowAndOutProducts.length > 0 ? "warning" : "success"}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              {lowAndOutProducts.slice(0, 6).map((product) => {
                const isOut = product.stock <= 0;
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">
                        {isOut ? "Producto agotado" : `Minimo ${product.minStock ?? 0}`}
                      </p>
                    </div>
                    <InventoryStatusBadge
                      label={isOut ? `Stock ${product.stock}` : `${product.stock} disponible`}
                      variant={isOut ? "danger" : "warning"}
                    />
                  </div>
                );
              })}
              {lowAndOutProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  No hay productos con stock bajo. Tu inventario se ve saludable por ahora.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-900">Productos destacados</CardTitle>
              <p className="text-sm text-slate-600">
                Ultimos productos creados para continuar ajustes o revisar precios.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              {latestProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      ${Number(product.price.toString()).toFixed(2)}
                      {product.cost ? ` · costo $${Number(product.cost.toString()).toFixed(2)}` : ""}
                    </p>
                  </div>
                  <InventoryStatusBadge
                    label={`Stock ${product.stock}`}
                    variant={product.stock <= 0 ? "danger" : product.minStock && product.stock <= product.minStock ? "warning" : "success"}
                  />
                </div>
              ))}
              {latestProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  Aun no hay productos creados. Usa “Agregar producto” para comenzar.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-900">Actividad de inventario</CardTitle>
              <p className="text-sm text-slate-600">{filteredLabel}</p>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6">
              {movements.slice(0, 6).map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{movement.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {movement.createdAt.toLocaleString("es-EC")} · stock actual {movement.product.stock}
                      </p>
                    </div>
                    <InventoryStatusBadge
                      label={movement.type === "sale" ? "Venta" : "Ajuste"}
                      variant={movement.type === "sale" ? "info" : "neutral"}
                    />
                  </div>
                  <p
                    className={`mt-2 text-sm font-medium ${
                      movement.quantity < 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity} unidades
                  </p>
                </div>
              ))}
              {movements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  Todavia no hay movimientos de stock. Ajusta stock o registra una venta para verlos aqui.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-900">Filtrar movimientos</CardTitle>
              <p className="text-sm text-slate-600">
                Busca por producto o enfoca la vista en ventas y ajustes.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 px-6 pb-6">
              <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <select
                  name="productId"
                  defaultValue={resolvedSearchParams.productId ?? ""}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">Todos los productos</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <select
                  name="type"
                  defaultValue={type ?? ""}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">Todos</option>
                  <option value="sale">Ventas</option>
                  <option value="adjustment">Ajustes</option>
                </select>
                <Button type="submit">Filtrar</Button>
              </form>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Productos visibles</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{products.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Ajustes</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{adjustmentMovements.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Ventas</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{saleMovements.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </BasicModuleShell>
  );
}
