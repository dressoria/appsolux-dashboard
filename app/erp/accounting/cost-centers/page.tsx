import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCostCenters } from "@/lib/api/erpnext/accounting";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpAccountingCostCentersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver centros de costo.</p>
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
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Centros de costo
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Centros de costo</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver centros de costo.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const companies = await getErpnextCompanies().catch(() => []);
  const firstCompany = companies[0];
  const costCenters = await getErpnextCostCenters(firstCompany?.name).catch(() => []);

  const activeLeafs = costCenters.filter((c) => c.disabled !== 1 && c.is_group !== 1);
  const groups = costCenters.filter((c) => c.is_group === 1);
  const disabled = costCenters.filter((c) => c.disabled === 1);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Centros de costo
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Centros de costo</h1>
            <p className="mt-1 text-muted-foreground">
              {activeLeafs.length} activos · {groups.length} grupos · {disabled.length} inactivos
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={routes.erpAccounting}>Volver a contabilidad</Link>
          </Button>
        </div>

        {costCenters.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No se encontraron centros de costo. Los centros de costo se configuran
              en ERPNext para asignar ingresos y gastos por area o proyecto.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Centros de costo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left">Centro de costo</th>
                      <th className="px-4 py-2 text-left">Empresa</th>
                      <th className="px-4 py-2 text-left">Padre</th>
                      <th className="px-4 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costCenters.map((center) => (
                      <tr key={center.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">
                          {center.cost_center_name ?? center.name}
                          {center.is_group === 1 ? (
                            <span className="ml-2 inline-flex h-4 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">
                              Grupo
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {center.company ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {center.parent_cost_center ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          {center.disabled === 1 ? (
                            <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs text-slate-500">
                              Inactivo
                            </span>
                          ) : (
                            <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                              Activo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uso de centros de costo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Los centros de costo permiten asignar ingresos y gastos a areas,
              proyectos o sucursales especificas del negocio.
            </p>
            <p>
              Se asignan en facturas de venta, facturas de compra, pagos y
              asientos contables.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
