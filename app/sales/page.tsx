import Link from "next/link";

import { AppModuleShell } from "@/components/appsolux/layout/app-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { getSriModuleStatus, getSriDocuments } from "@/lib/core/sri";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function SalesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AppModuleShell
        appName="Ventas"
        appDescription="Pedidos, cotizaciones, ventas y cuentas por cobrar."
        badge="Ventas"
        badgeVariant="emerald"
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </AppModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [reports, sriStatus, plan, sriDocs] = await Promise.all([
    getBasicReports(tenant.id),
    getSriModuleStatus(tenant.id),
    getTenantPlanState(tenant.id),
    getSriDocuments(tenant.id, { take: 5 }),
  ]);

  function money(value: { toString(): string }) {
    return `$${Number(value.toString()).toFixed(2)}`;
  }

  return (
    <AppModuleShell
      appName="Ventas"
      appDescription="Pedidos, cotizaciones, ventas y cuentas por cobrar de tu negocio."
      badge="Ventas"
      badgeVariant="emerald"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ventas del mes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(reports.salesToday)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pendiente de cobro</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(reports.pendingMonth)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total ventas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {reports.counts.receipts}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas basicas (Inventario & POS)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Registra ventas, gestiona clientes, caja y stock desde el modulo basico.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.basicPos}>Nueva venta</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.basicSales}>Ver ventas</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.basicCustomers}>Clientes</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.basicCash}>Caja</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturacion Electronica (SRI)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sriStatus.hasProfile ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Empresa configurada con RUC {sriStatus.ruc ?? ""}. Ambiente:{" "}
                  {sriStatus.environment === "TEST" ? "Pruebas" : "Produccion"}.
                </p>
                {sriDocs.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {sriDocs.length} comprobante{sriDocs.length !== 1 ? "s" : ""} preparado{sriDocs.length !== 1 ? "s" : ""}.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={routes.sri}>Configuracion</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={routes.sriDocuments}>Comprobantes</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Configura tu empresa y RUC para emitir facturas electronicas con el SRI Ecuador.
                </p>
                <Button asChild className="w-full">
                  <Link href={routes.sriCompany}>Configurar empresa</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {plan.canRequestDedicatedErp && (
          <Card>
            <CardHeader>
              <CardTitle>ERP Avanzado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cotizaciones, pedidos de venta, cuentas por cobrar y reportes financieros avanzados.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={routes.erp}>Abrir ERP</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Uso del plan: {plan.planName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Ventas registradas: {reports.counts.receipts} / {plan.limits.receipts}</p>
            <p>Clientes: {reports.counts.customers} / {plan.limits.customers}</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={routes.billing}>Ver plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppModuleShell>
  );
}
