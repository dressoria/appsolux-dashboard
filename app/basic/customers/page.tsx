import { CustomerForm } from "@/components/appsolux/basic/customer-form";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCustomers } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function BasicCustomersPage() {
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
  const customers = await listCustomers(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-2 text-muted-foreground">
            {customers.length} / {plan.limits.customers} clientes del plan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customers.map((customer) => (
              <div key={customer.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{customer.name}</p>
                <p className="text-muted-foreground">
                  {customer.phone ?? "Sin telefono"} · saldo $
                  {customer.balance.toString()}
                </p>
              </div>
            ))}
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aun no hay clientes.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
