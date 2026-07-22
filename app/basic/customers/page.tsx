import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { CustomerForm } from "@/components/appsolux/basic/customer-form";
import { CustomerList } from "@/components/appsolux/basic/customer-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicUsageCounts, listCustomers } from "@/lib/core/lightweight-pos";
import { getTenantModeState } from "@/lib/core/tenant-mode";
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
      <BasicModuleShell
        title="Clientes"
        description="Registra clientes para llevar historial y ventas fiadas."
        activeHref={routes.basicCustomers}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const tenantMode = await getTenantModeState(tenant);
  const [customers, counts] = await Promise.all([
    listCustomers(tenant.id, { search: resolvedSearchParams.q }),
    getBasicUsageCounts(tenant.id),
  ]);
  const limitReached = counts.customers >= tenantMode.operationalLimits.customers;

  return (
    <BasicModuleShell
      title="Clientes"
      description="Clientes ligeros, contacto y saldos pendientes para ventas fiadas."
      activeHref={routes.basicCustomers}
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {counts.customers} / {tenantMode.operationalLimits.customers} clientes del plan.
        </p>

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
    </BasicModuleShell>
  );
}
