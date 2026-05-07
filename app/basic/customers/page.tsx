import Link from "next/link";

import { CustomerForm } from "@/components/appsolux/basic/customer-form";
import { CustomerList } from "@/components/appsolux/basic/customer-list";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCustomers } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicCustomersPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function BasicCustomersPage({
  searchParams,
}: BasicCustomersPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const plan = await getTenantPlanState(tenant.id);
  const [customers, allCustomers] = await Promise.all([
    listCustomers(tenant.id, { search: resolvedSearchParams.q }),
    listCustomers(tenant.id),
  ]);
  const limitReached = allCustomers.length >= plan.limits.customers;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-2 text-muted-foreground">
            {allCustomers.length} / {plan.limits.customers} clientes del plan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {limitReached ? (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Llegaste al limite de tu plan actual.{" "}
                <Button asChild variant="link" className="h-auto p-0">
                  <Link href="/billing">Mejorar plan</Link>
                </Button>
              </div>
            ) : null}
            <CustomerForm disabled={limitReached} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <form className="mb-4 flex gap-2">
              <Input
                name="q"
                defaultValue={resolvedSearchParams.q ?? ""}
                placeholder="Buscar por nombre o telefono"
              />
              <Button type="submit">Buscar</Button>
            </form>
            <CustomerList
              customers={customers.map((customer) => ({
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                balance: customer.balance.toString(),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
