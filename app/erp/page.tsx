import { ErpTabs } from "@/components/appsolux/erp/erp-tabs";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { AdvancedModeBlockedCard } from "@/components/appsolux/dashboard/advanced-mode-blocked-card";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getErpnextStockLedger } from "@/lib/api/erpnext/stock-ledger";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getTenantModeState } from "@/lib/core/tenant-mode";
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

function getErpBlockedDescription(
  erpProvisioning: Awaited<ReturnType<typeof getErpProvisioningState>>
) {
  if (erpProvisioning.isSimulated) {
    return "La validacion tecnica termino, pero ERP/POS/Reportes seguiran bloqueados hasta completar el provisioning real.";
  }
  if (erpProvisioning.isPending) {
    return erpProvisioning.displayStatus;
  }
  if (erpProvisioning.isFailed) {
    return `${erpProvisioning.displayStatus}. Revisa el ultimo error o reintenta la solicitud si tienes permisos.`;
  }
  if (erpProvisioning.status === "not_configured") {
    return "Este tenant todavia no tiene un ERP solicitado. Primero solicita el ERP dedicado; Appsolux creara un job y el worker de infraestructura lo preparara fuera del dashboard.";
  }

  return erpProvisioning.displayStatus;
}

export default async function ErpPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el modulo ERP de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);
  const erpProvisioning = tenantMode.erpProvisioning;

  if (!erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">ERP</p>
            <h1 className="text-3xl font-semibold tracking-tight">ERP</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {getErpBlockedDescription(erpProvisioning)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tenant: {tenant.name}
            </p>
          </div>

          <ErpDedicatedProvisionCard
            provisioning={erpProvisioning}
            canManage={canManageSettings(user)}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />

          <Card>
            <CardHeader>
              <CardTitle>Datos ERP protegidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {erpProvisioning.isSimulated ? (
                <>
                  <p>
                    El worker ejecuto el script en modo dry-run. No se creo
                    ningun sitio ERPNext real.
                  </p>
                  <p>
                    Productos, bodegas, clientes, inventario y movimientos
                    permanecen bloqueados hasta que el aprovisionamiento real se
                    complete en la VM.
                  </p>
                </>
              ) : erpProvisioning.isPending || erpProvisioning.isFailed ? (
                <p>{erpProvisioning.displayStatus}</p>
              ) : (
                <>
                  <p>
                    Productos, bodegas, clientes, inventario y movimientos no se
                    cargaran hasta que el ERP este activo.
                  </p>
                  <p>
                    Esto evita errores en tenants reales que aun no tienen un sitio
                    ERPNext dedicado.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <AdvancedModeBlockedCard
            title="Modo basico disponible"
            erpProvisioning={erpProvisioning}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />
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
    warehousesResult,
    inventoryResult,
    stockLedgerResult,
    customersResult,
    mastersResult,
  ] = await Promise.all([
    loadErpResource(getErpnextItems, []),
    loadErpResource(getErpnextWarehouses, []),
    loadErpResource(getErpnextInventory, []),
    loadErpResource(getErpnextStockLedger, []),
    loadErpResource(getErpnextCustomers, []),
    loadErpResource(getErpnextMasters, emptyMasters),
  ]);
  const resourceErrors = [
    { label: "Productos", message: itemsResult.error },
    { label: "Bodegas", message: warehousesResult.error },
    { label: "Inventario", message: inventoryResult.error },
    { label: "Movimientos", message: stockLedgerResult.error },
    { label: "Clientes", message: customersResult.error },
    { label: "Configuracion", message: mastersResult.error },
  ].filter(
    (resourceError): resourceError is { label: string; message: string } =>
      Boolean(resourceError.message)
  );
  const masterWarnings = [
    mastersResult.data.itemGroups.length === 0 ? "Sin categorias" : null,
    mastersResult.data.uoms.length === 0 ? "Sin unidades" : null,
    mastersResult.data.territories.length === 0 ? "Sin territorios" : null,
    mastersResult.data.companies.length === 0 ? "Sin empresa configurada" : null,
  ].filter((warning): warning is string => Boolean(warning));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">ERP</p>
          <h1 className="text-3xl font-semibold tracking-tight">ERP</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Inventario, clientes, ventas y gestion operativa conectada al ERP.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tenant: {tenant.name}
          </p>
        </div>

        <ErpTabs
          items={itemsResult.data}
          warehouses={warehousesResult.data}
          inventory={inventoryResult.data}
          stockLedgerEntries={stockLedgerResult.data}
          customers={customersResult.data}
          masters={mastersResult.data}
          masterWarnings={masterWarnings}
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
