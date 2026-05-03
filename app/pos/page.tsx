import { PosClient } from "@/components/appsolux/pos/pos-client";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
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
  const emptyMasters: ErpnextMasters = {
    itemGroups: [],
    uoms: [],
    territories: [],
    companies: [],
  };
  const [itemsResult, inventoryResult, customersResult, warehousesResult, mastersResult] =
    await Promise.all([
      loadErpResource(getErpnextItems, []),
      loadErpResource(getErpnextInventory, []),
      loadErpResource(getErpnextCustomers, []),
      loadErpResource(getErpnextWarehouses, []),
      loadErpResource(getErpnextMasters, emptyMasters),
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
