import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getBasicReports,
  getDailyCashSummary,
  listStockMovements,
} from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function money(value: { toString(): string }) {
  return `$${Number(value.toString()).toFixed(2)}`;
}

export async function BasicHomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Historial Basico"
        description="Inicia sesion para ver el historial operativo del modo Core."
        activeHref={routes.facturacionHistoryBasic}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [reports, cash, movements, plan] = await Promise.all([
    getBasicReports(tenant.id),
    getDailyCashSummary(tenant.id),
    listStockMovements(tenant.id, { take: 5 }),
    getTenantPlanState(tenant.id),
  ]);

  return (
    <BasicModuleShell
      title="Historial Basico"
      description="Resumen historico del modo Core: ventas, caja, stock y movimientos registrados."
      activeHref={routes.facturacionHistoryBasic}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Ventas de hoy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(reports.salesToday)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cobrado hoy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(cash.totalCollected)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pendiente</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(reports.pendingMonth)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stock critico</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {reports.lowStockProducts.length + reports.outOfStockProducts.length}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Accesos rapidos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Nueva venta", routes.facturacionPos],
              ["Agregar producto", routes.facturacionProducts],
              ["Agregar cliente", routes.facturacionCustomers],
              ["Ver ventas", routes.facturacionDocuments],
              ["Caja diaria", routes.facturacionCash],
              ["Movimientos de stock", routes.facturacionInventory],
            ].map(([label, href]) => (
              <Button key={href} asChild variant="outline" className="justify-start">
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso del plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Productos: {reports.counts.products} / {plan.limits.products}</p>
            <p>Clientes: {reports.counts.customers} / {plan.limits.customers}</p>
            <p>Ventas: {reports.counts.receipts} / {plan.limits.receipts}</p>
            <Button asChild variant="outline" className="mt-2">
              <Link href={routes.billing}>Mejorar plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alertas de stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...reports.outOfStockProducts, ...reports.lowStockProducts]
              .slice(0, 6)
              .map((product) => (
                <div key={product.id} className="flex justify-between rounded-md border p-2 text-sm">
                  <span>{product.name}</span>
                  <span className="text-muted-foreground">Stock {product.stock}</span>
                </div>
              ))}
            {reports.outOfStockProducts.length + reports.lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes productos con stock bajo. Buen pulso de inventario.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ultimos movimientos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {movements.map((movement) => (
              <div key={movement.id} className="flex justify-between rounded-md border p-2 text-sm">
                <span>{movement.product.name}</span>
                <span className="text-muted-foreground">
                  {movement.type} {movement.quantity}
                </span>
              </div>
            ))}
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavia no hay movimientos de stock. Ajusta stock o registra una venta para verlos aqui.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </BasicModuleShell>
  );
}
