import Link from "next/link";
import { CreateWarehouseDialog } from "@/components/appsolux/erp/create-warehouse-dialog";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpInventoryWarehousesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver bodegas.
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
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">
                Inventario
              </Link>{" "}
              / Bodegas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Bodegas / ubicaciones
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver bodegas.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [warehouses, companies] = await Promise.all([
    getErpnextWarehouses().catch(() => []),
    getErpnextCompanies().catch(() => []),
  ]);
  const operative = warehouses.filter((w) => w.is_group !== 1);
  const groups = warehouses.filter((w) => w.is_group === 1);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">
                Inventario
              </Link>{" "}
              / Bodegas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Bodegas / ubicaciones
            </h1>
            <p className="mt-2 text-muted-foreground">
              Sucursales, mostradores y bodegas centrales donde se almacena
              stock.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryStock}>Ver stock</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.settings}>Configuracion</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventory}>Volver a inventario</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        {groups.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
            Las bodegas de grupo son estructura organizacional y no reciben
            stock directamente. Solo las bodegas operativas pueden usarse en
            ventas, compras y ajustes.
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <CreateWarehouseDialog companies={companies} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bodegas operativas</CardTitle>
          </CardHeader>
          <CardContent>
            {operative.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay bodegas operativas configuradas. Usa el boton
                &ldquo;Nueva Bodega&rdquo; para crear la primera.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Bodega</th>
                      <th className="py-2 pr-4 font-medium">Empresa</th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {operative.map((warehouse) => (
                      <tr key={warehouse.name}>
                        <td className="py-2 pr-4 font-medium">
                          {warehouse.warehouse_name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {warehouse.company ?? "-"}
                        </td>
                        <td className="py-2">
                          {warehouse.disabled === 1 ? (
                            <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
                              Inactiva
                            </span>
                          ) : (
                            <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                              Activa
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {groups.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Grupos de bodegas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Grupo</th>
                      <th className="py-2 font-medium">Empresa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groups.map((warehouse) => (
                      <tr key={warehouse.name}>
                        <td className="py-2 pr-4 font-medium">
                          {warehouse.warehouse_name}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {warehouse.company ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
