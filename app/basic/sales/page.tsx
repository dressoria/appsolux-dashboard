import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listSales } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function BasicSalesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const plan = await getTenantPlanState(tenant.id);
  const sales = await listSales(tenant.id);
  const activeSales = sales.filter((sale) => sale.status !== "canceled");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">Ventas</h1>
          <p className="mt-2 text-muted-foreground">
            {activeSales.length} / {plan.limits.receipts} ventas o recibos del
            plan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recibos recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sales.map((sale) => (
              <div key={sale.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    ${sale.total.toString()} · {sale.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sale.createdAt.toLocaleString("es-EC")}
                  </p>
                </div>
                <p className="text-muted-foreground">
                  Cliente: {sale.customer?.name ?? "Consumidor final"} · pago{" "}
                  {sale.paymentStatus}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sale.items
                    .map((item) => `${item.product.name} x${item.quantity}`)
                    .join(", ")}
                </p>
              </div>
            ))}
            {sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aun no hay ventas.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
