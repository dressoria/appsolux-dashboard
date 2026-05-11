import Link from "next/link";
import { CreateCustomerForm } from "@/components/appsolux/erp/create-customer-form";
import { CustomersTable } from "@/components/appsolux/erp/customers-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpCustomersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver clientes ERP.
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
          <h1 className="text-3xl font-semibold tracking-tight">Clientes ERP</h1>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver clientes ERP.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [customers, masters] = await Promise.all([
    getErpnextCustomers().catch(() => []),
    getErpnextMasters().catch(() => ({
      itemGroups: [],
      uoms: [],
      territories: [],
      companies: [],
    })),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Clientes
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Clientes ERP
            </h1>
            <p className="mt-2 text-muted-foreground">
              Directorio de clientes de ERP Avanzado, separado de Appsolux
              Basico.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpCustomerBalances}>Clientes con saldo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinanceReceivables}>Cuentas por cobrar</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <CreateCustomerForm territories={masters.territories} />
        <CustomersTable customers={customers} territories={masters.territories} />
      </div>
    </DashboardShell>
  );
}
