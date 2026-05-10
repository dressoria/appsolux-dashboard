import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpInventoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver inventario.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Inventario
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Inventario
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para gestionar inventario.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [items, warehouses, inventory] = await Promise.all([
    getErpnextItems().catch(() => []),
    getErpnextWarehouses().catch(() => []),
    getErpnextInventory().catch(() => []),
  ]);

  const operativeWarehouses = warehouses.filter(
    (w) => w.is_group !== 1 && w.disabled !== 1
  );
  const noStockRows = inventory.filter(
    (b) => (b.actual_qty ?? 0) <= 0
  ).length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Inventario
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Inventario
            </h1>
            <p className="mt-2 text-muted-foreground">
              Controla productos, stock, bodegas, movimientos y ajustes desde
              un solo lugar.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={routes.erp}>Volver al ERP</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Productos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {items.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bodegas operativas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {operativeWarehouses.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Filas de stock
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {inventory.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sin stock
              </CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-semibold ${noStockRows > 0 ? "text-amber-600" : ""}`}
            >
              {noStockRows}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Acciones rapidas
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={routes.erpInventoryProducts}>Ver productos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryStock}>Ver stock actual</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${routes.erpInventoryStock}?filter=low`}>
                Stock bajo
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryTransfers}>Transferencias</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryPhysicalCount}>Toma fisica</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryValuation}>Inventario valorizado</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryAdjustments}>
                Ajustar inventario
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryMovements}>Ver movimientos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryWarehouses}>Ver bodegas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesReceipts}>
                Ingresos de mercaderia
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Flujo de inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                {
                  step: 1,
                  title: "Crea productos",
                  desc: "Registra los productos con codigo, nombre, categoria y unidad de medida.",
                  href: routes.erpInventoryProducts,
                },
                {
                  step: 2,
                  title: "Configura bodegas",
                  desc: "Define sucursales, mostradores o bodegas centrales donde guardas stock.",
                  href: routes.erpInventoryWarehouses,
                },
                {
                  step: 3,
                  title: "Ingresa o ajusta stock",
                  desc: "Registra entradas de mercaderia o ajusta cantidades por conteo fisico.",
                  href: routes.erpInventoryAdjustments,
                },
                {
                  step: 4,
                  title: "Vende o transfiere",
                  desc: "El stock se descuenta automaticamente al registrar ventas en el POS.",
                  href: routes.pos,
                },
                {
                  step: 5,
                  title: "Revisa movimientos y reportes",
                  desc: "Consulta el kardex, historial de movimientos y reportes de stock.",
                  href: routes.erpInventoryMovements,
                },
              ].map(({ step, title, desc, href }) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                    {step}
                  </span>
                  <div>
                    <Link
                      href={href}
                      className="font-medium hover:underline"
                    >
                      {title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Productos",
              desc: "Catalogo de productos con codigo, categoria y unidad.",
              href: routes.erpInventoryProducts,
              status: "Disponible",
            },
            {
              title: "Stock actual",
              desc: "Cantidades disponibles, proyectadas y reservadas por bodega.",
              href: routes.erpInventoryStock,
              status: "Disponible",
            },
            {
              title: "Movimientos",
              desc: "Historial de entradas, salidas, ajustes y transferencias.",
              href: routes.erpInventoryMovements,
              status: "Disponible",
            },
            {
              title: "Ajustes de inventario",
              desc: "Corrige diferencias de stock por conteo fisico, merma o errores.",
              href: routes.erpInventoryAdjustments,
              status: "Disponible",
            },
            {
              title: "Kardex por producto",
              desc: "Movimientos detallados con saldo para un producto especifico.",
              href: routes.erpInventoryKardex,
              status: "Disponible",
            },
            {
              title: "Bodegas / ubicaciones",
              desc: "Sucursales, mostradores y bodegas centrales configuradas.",
              href: routes.erpInventoryWarehouses,
              status: "Disponible",
            },
            {
              title: "Transferencias",
              desc: "Mueve productos entre sucursales o bodegas.",
              href: routes.erpInventoryTransfers,
              status: "Disponible",
            },
            {
              title: "Toma fisica",
              desc: "Compara conteo real con stock del sistema y aplica ajustes.",
              href: routes.erpInventoryPhysicalCount,
              status: "Disponible",
            },
            {
              title: "Inventario valorizado",
              desc: "Valor total del inventario calculado por costo promedio.",
              href: routes.erpInventoryValuation,
              status: "Disponible",
            },
            {
              title: "Ingresos de mercaderia",
              desc: "Recepciones de productos comprados registradas en bodega.",
              href: routes.erpPurchasesReceipts,
              status: "Disponible",
            },
            {
              title: "Reportes de inventario",
              desc: "Stock bajo, productos mas vendidos e inventario valorizado.",
              href: routes.reports,
              status: "Disponible",
            },
          ].map(({ title, desc, href, status }) => (
            <Link
              key={title}
              href={href}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{title}</h3>
                <span
                  className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${
                    status === "Disponible"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
