import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { PaymentMethodsTable } from "@/components/appsolux/reports/payment-methods-table";
import { AdvancedModeBlockedCard } from "@/components/appsolux/dashboard/advanced-mode-blocked-card";
import { ReportsSummary } from "@/components/appsolux/reports/reports-summary";
import { TopProductsTable } from "@/components/appsolux/reports/top-products-table";
import { LowStockTable } from "@/components/appsolux/reports/low-stock-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildReportsDashboardData } from "@/lib/api/erpnext/reports";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { ReportDateRange } from "@/types/reports";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

function normalizeDate(value: string | undefined) {
  return value?.trim() || undefined;
}

function getReportsBlockedDescription(
  erpProvisioning: Awaited<ReturnType<typeof getErpProvisioningState>>
) {
  if (erpProvisioning.isSimulated) {
    return "La validacion tecnica termino, pero ERP/POS/Reportes seguiran bloqueados hasta completar el provisioning real.";
  }
  if (erpProvisioning.isPending || erpProvisioning.isFailed) {
    return erpProvisioning.displayStatus;
  }
  if (erpProvisioning.status === "not_configured") {
    return "Los reportes necesitan ventas, pagos e inventario desde ERP. Solicita primero el ERP dedicado para este tenant.";
  }

  return erpProvisioning.displayStatus;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver reportes.
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
            <p className="text-sm text-muted-foreground">Reportes</p>
            <h1 className="text-3xl font-semibold tracking-tight">Reportes</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {getReportsBlockedDescription(erpProvisioning)}
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
              <CardTitle>Reportes protegidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {erpProvisioning.isSimulated ? (
                <p>
                  El worker ejecuto el dry-run correctamente. Appsolux no
                  calculara reportes reales hasta que el sitio ERPNext este
                  aprovisionado en produccion.
                </p>
              ) : erpProvisioning.isPending || erpProvisioning.isFailed ? (
                <p>{erpProvisioning.displayStatus}</p>
              ) : (
                <p>
                  Appsolux no calculara reportes reales hasta que el ERP este
                  activo. Asi evitamos errores cuando el tenant esta en onboarding.
                </p>
              )}
            </CardContent>
          </Card>

          <AdvancedModeBlockedCard
            title="Reportes basicos disponibles"
            erpProvisioning={erpProvisioning}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />
        </div>
      </DashboardShell>
    );
  }

  const resolvedSearchParams = await searchParams;
  const range: ReportDateRange = {
    from: normalizeDate(resolvedSearchParams.from),
    to: normalizeDate(resolvedSearchParams.to),
  };
  const reports = await buildReportsDashboardData(range);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Reportes</h1>
            <p className="mt-2 text-muted-foreground">
              Indicadores basicos de ventas, cobros e inventario con datos
              reales.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tenant: {tenant.name} ({tenant.slug})
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Los reportes se calculan con documentos reales del ERP.
              </p>
              <p className="text-sm text-muted-foreground">
                Los valores pueden cambiar al anular facturas, registrar pagos o
                ajustar inventario. Esta es una primera version; exportaciones y
                graficos avanzados vendran despues.
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" action="/reports">
              <div className="space-y-2">
                <Label htmlFor="reports_from">Desde</Label>
                <Input
                  id="reports_from"
                  name="from"
                  type="date"
                  defaultValue={range.from ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reports_to">Hasta</Label>
                <Input
                  id="reports_to"
                  name="to"
                  type="date"
                  defaultValue={range.to ?? ""}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit">Filtrar</Button>
                <Button asChild type="button" variant="outline">
                  <a href="/reports">Limpiar</a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ReportsSummary reports={reports} />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ventas y facturas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Facturas pagadas: {reports.sales.paid_invoices}. Facturas
                pendientes: {reports.sales.unpaid_invoices}. Borradores:{" "}
                {reports.sales.draft_invoices}. Anuladas:{" "}
                {reports.sales.cancelled_invoices}.
              </p>
              <p>
                El total vendido considera facturas no anuladas. El pendiente
                considera facturas confirmadas con saldo por cobrar.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cobros por metodo de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentMethodsTable methods={reports.payments.by_method} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos mas vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <TopProductsTable products={reports.top_products} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock bajo / sin stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Stock bajo</h2>
                  <p className="text-sm text-muted-foreground">
                    Productos con existencias mayores a 0 y hasta 5 unidades.
                  </p>
                </div>
                <LowStockTable
                  items={reports.low_stock}
                  emptyMessage="No hay productos con bajo stock."
                />
              </div>
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Sin stock</h2>
                  <p className="text-sm text-muted-foreground">
                    Registros de inventario sin unidades disponibles.
                  </p>
                </div>
                <LowStockTable
                  items={reports.out_of_stock}
                  emptyMessage="No hay productos sin stock."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
