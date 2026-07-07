import Link from "next/link";
import { CoreMigrationNotice } from "@/components/appsolux/business-suite/core-migration-notice";
import { CreateCustomerForm } from "@/components/appsolux/erp/create-customer-form";
import { CustomersTable } from "@/components/appsolux/erp/customers-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getPrismaClient } from "@/lib/db/prisma";
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
            Inicia sesion para ver clientes.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
    return (
        <DashboardShell>
        <div className="space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>Gestion Empresarial activa es necesaria para ver los clientes operativos.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.facturacion}>Ir a Facturacion</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [customers, masters, coreCustomerCount] = await Promise.all([
    getErpnextCustomers().catch(() => []),
    getErpnextMasters().catch(() => ({
      itemGroups: [],
      uoms: [],
      territories: [],
      companies: [],
    })),
    getPrismaClient().lightweightCustomer.count({ where: { tenantId: tenant.id } }),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <CoreMigrationNotice
          coreProductCount={0}
          coreCustomerCount={coreCustomerCount}
          type="customers"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.facturacion} className="hover:underline">
                Facturacion
              </Link>{" "}
              / Clientes
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Clientes
            </h1>
            <p className="mt-2 text-muted-foreground">
              Directorio operativo de clientes gestionado por el motor empresarial de Facturacion.
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
              <Link href={routes.facturacion}>Volver a Facturacion</Link>
            </Button>
          </div>
        </div>

        <CreateCustomerForm territories={masters.territories} />
        <CustomersTable customers={customers} territories={masters.territories} />
      </div>
    </DashboardShell>
  );
}
