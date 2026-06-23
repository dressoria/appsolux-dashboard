import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { PosClient } from "@/components/appsolux/pos/pos-client";
import { AdvancedModeBlockedCard } from "@/components/appsolux/dashboard/advanced-mode-blocked-card";
import { AdvancedErpNotActivatedState } from "@/components/appsolux/erp/advanced-erp-not-activated-state";
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
import { getErpProductPricingMap } from "@/lib/core/erp-pricing";
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

function getPosBlockedDescription(
  erpProvisioning: Awaited<ReturnType<typeof getErpProvisioningState>>
) {
  if (erpProvisioning.isSimulated) {
    return "La validacion tecnica termino, pero ERP/POS/Reportes seguiran bloqueados hasta completar el provisioning real.";
  }
  if (erpProvisioning.isPending || erpProvisioning.isFailed) {
    return erpProvisioning.displayStatus;
  }
  if (erpProvisioning.status === "not_configured") {
    return "El punto de venta necesita productos, bodegas, clientes, metodos de pago e inventario desde Gestion Empresarial. Solicita primero un Sistema Dedicado.";
  }

  return erpProvisioning.displayStatus;
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
  const tenantMode = await getTenantModeState(tenant);
  const erpProvisioning = tenantMode.erpProvisioning;

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">POS</p>
            <h1 className="text-3xl font-semibold tracking-tight">Gestion Empresarial no activada</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {getPosBlockedDescription(erpProvisioning)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>

          <AdvancedErpNotActivatedState
            description="Tu tenant esta operando en modo Core. El punto de venta principal de Gestion Empresarial no cargara productos ni inventario hasta que la suite este habilitada."
          />

          <ErpDedicatedProvisionCard
            provisioning={erpProvisioning}
            canManage={canManageSettings(user)}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />

          <Card>
            <CardHeader>
              <CardTitle>POS protegido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {erpProvisioning.isSimulated ? (
                <p>
                  El worker ejecuto el dry-run correctamente. El POS no cargara
                  productos ni intentara vender hasta que la instancia operativa
                  este activa.
                </p>
              ) : erpProvisioning.isPending || erpProvisioning.isFailed ? (
                <p>{erpProvisioning.displayStatus}</p>
              ) : (
                <p>
                  El POS no cargara productos ni intentara vender hasta que
                  Gestion Empresarial este activa para este tenant.
                </p>
              )}
            </CardContent>
          </Card>

          <AdvancedModeBlockedCard
            title="Historial basico disponible"
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
  const pricingMap = await getErpProductPricingMap(
    tenant.id,
    itemsResult.data.map((item) => item.item_code)
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
          pricingMap={pricingMap}
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
