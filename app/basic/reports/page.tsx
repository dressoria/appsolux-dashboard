import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [reports, plan] = await Promise.all([
    getBasicReports(tenant.id),
    getTenantPlanState(tenant.id),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Reportes basicos
          </h1>
          <p className="mt-2 text-muted-foreground">
            Indicadores simples desde Appsolux Core DB.
          </p>
        </div>

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
    </DashboardShell>
  );
}
