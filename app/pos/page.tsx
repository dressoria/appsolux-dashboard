import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { PosClient } from "@/components/appsolux/pos/pos-client";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { ErpnextMasters } from "@/types/erpnext";

type LoadResult<T> = {
  data: T;
  error: string | null;
};

async function loadErpResource<T>(
  loader: () => Promise<T>,
  fallback: T
): Promise<LoadResult<T>> {
  try {
    return {
      data: await loader(),
      error: null,
    };
  } catch (error) {
    return {
      data: fallback,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cargar informacion desde el ERP",
    };
  }
}

export default async function PosPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para usar el POS de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const erpProvisioning = await getErpProvisioningState(tenant);

  if (!erpProvisioning.isReady) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">POS</p>
            <h1 className="text-3xl font-semibold tracking-tight">POS</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              El punto de venta necesita productos, bodegas, clientes, metodos
              de pago e inventario desde ERP. Activa primero el ERP dedicado.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tenant: {tenant.name}
            </p>
          </div>

          <ErpDedicatedProvisionCard
            status={erpProvisioning.status}
            desiredSiteName={erpProvisioning.desiredSiteName}
            desiredCompanyName={erpProvisioning.desiredCompanyName}
            latestJobId={erpProvisioning.latestJobId}
            lastError={erpProvisioning.lastError}
            canManage={canManageSettings(user)}
          />

          <Card>
            <CardHeader>
              <CardTitle>POS protegido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                El POS no cargara productos ni intentara vender hasta que el ERP
                este activo para este tenant.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const emptyMasters: ErpnextMasters = {
    itemGroups: [],
    uoms: [],
    territories: [],
    companies: [],
  };
  const [
    itemsResult,
    inventoryResult,
    customersResult,
    warehousesResult,
    mastersResult,
    modesOfPaymentResult,
  ] = await Promise.all([
    loadErpResource(getErpnextItems, []),
    loadErpResource(getErpnextInventory, []),
    loadErpResource(getErpnextCustomers, []),
    loadErpResource(getErpnextWarehouses, []),
    loadErpResource(getErpnextMasters, emptyMasters),
    loadErpResource(getErpnextModesOfPayment, []),
  ]);
  const usableWarehouses = warehousesResult.data.filter(
    (warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1
  );
  const resourceErrors = [
    { label: "Productos", message: itemsResult.error },
    { label: "Inventario", message: inventoryResult.error },
    { label: "Clientes", message: customersResult.error },
    { label: "Bodegas", message: warehousesResult.error },
    { label: "Empresas", message: mastersResult.error },
    { label: "Metodos de pago", message: modesOfPaymentResult.error },
  ].filter(
    (resourceError): resourceError is { label: string; message: string } =>
      Boolean(resourceError.message)
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PosClient
          items={itemsResult.data}
          inventory={inventoryResult.data}
          customers={customersResult.data}
          warehouses={usableWarehouses}
          companies={mastersResult.data.companies}
          modesOfPayment={modesOfPaymentResult.data}
          tenant={{
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          }}
        />

        {resourceErrors.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Revision de conexion ERP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {resourceErrors.map((resourceError) => (
                <p key={resourceError.label} className="text-sm text-destructive">
                  {resourceError.label}: {resourceError.message}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
