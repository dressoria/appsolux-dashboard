import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function money(value: { toString(): string }) {
  return `$${Number(value.toString()).toFixed(2)}`;
}

export default async function BasicReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Reportes basicos"
        description="Indicadores simples desde Appsolux Core DB."
        activeHref={routes.basicReports}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [reports, plan] = await Promise.all([
    getBasicReports(tenant.id),
    getTenantPlanState(tenant.id),
  ]);

  return (
    <BasicModuleShell
      title="Reportes basicos"
      description="Ventas, cobros, fiados, productos top y alertas de stock."
      activeHref={routes.basicReports}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Hoy</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {money(reports.salesToday)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {money(reports.salesMonth)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cobrado</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {money(reports.collectedMonth)}
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accesos operativos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.basicCash}>Ver caja diaria</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.basicStock}>Ver movimientos de stock</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Ventas por metodo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(reports.paymentsByMethod).map(([method, total]) => (
                <p key={method}>
                  {method}: {money(total)}
                </p>
              ))}
              {Object.keys(reports.paymentsByMethod).length === 0 ? (
                <p className="text-muted-foreground">
                  Aun no hay pagos este mes.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos mas vendidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reports.topProducts.map((product) => (
                <p key={product.name}>
                  {product.name}: {product.quantity} uds · {money(product.total)}
                </p>
              ))}
              {reports.topProducts.length === 0 ? (
                <p className="text-muted-foreground">
                  Aun no hay ventas para calcular productos top.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clientes con saldo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reports.pendingCustomers.map((customer) => (
                <p key={customer.id}>
                  {customer.name}: {money(customer.balance)}
                </p>
              ))}
              {reports.pendingCustomers.length === 0 ? (
                <p className="text-muted-foreground">
                  No tienes saldos pendientes.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stock bajo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.lowStockProducts.map((product) => (
                <div key={product.id} className="flex justify-between rounded-md border p-2 text-sm">
                  <span>{product.name}</span>
                  <span className="text-muted-foreground">
                    {product.stock} / min {product.minStock}
                  </span>
                </div>
              ))}
              {reports.lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin stock bajo.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agotados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.outOfStockProducts.map((product) => (
                <div key={product.id} className="rounded-md border p-2 text-sm">
                  {product.name}
                </div>
              ))}
              {reports.outOfStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay productos agotados.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Uso del plan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <p>
              Productos: {reports.counts.products} / {plan.limits.products}
            </p>
            <p>
              Clientes: {reports.counts.customers} / {plan.limits.customers}
            </p>
            <p>
              Ventas: {reports.counts.receipts} / {plan.limits.receipts}
            </p>
          </CardContent>
        </Card>
      </div>
    </BasicModuleShell>
  );
}
