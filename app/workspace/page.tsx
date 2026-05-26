import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicReports } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getSriModuleStatus } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function SriStatusBadge({ label }: { label: string }) {
  if (label === "not_started") {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
        Pendiente
      </span>
    );
  }
  if (label === "incomplete") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
        Configuracion incompleta
      </span>
    );
  }
  if (label === "ready_for_testing") {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
        Listo para pruebas
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
      Listo para produccion
    </span>
  );
}

export default async function WorkspacePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [plan, sriStatus, basicReports] = await Promise.all([
    getTenantPlanState(tenant.id),
    getSriModuleStatus(tenant.id),
    getBasicReports(tenant.id),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona un modulo para operar. Cada modulo es independiente y se activa segun tu plan.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Basic POS */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">Inventario y POS</CardTitle>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                  Activo
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Productos, stock, clientes, ventas, caja y reportes para operacion diaria.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Productos</p>
                  <p className="font-medium">{basicReports.counts.products}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Clientes</p>
                  <p className="font-medium">{basicReports.counts.customers}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ventas</p>
                  <p className="font-medium">{basicReports.counts.receipts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stock critico</p>
                  <p className="font-medium">
                    {basicReports.outOfStockProducts.length + basicReports.lowStockProducts.length}
                  </p>
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href={routes.basic}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>

          {/* SRI */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">Facturacion Electronica</CardTitle>
                <SriStatusBadge label={sriStatus.readinessLabel} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configura empresa, establecimientos, secuenciales, firma y comprobantes SRI Ecuador.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">RUC</p>
                  <p className="font-medium">{sriStatus.ruc ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ambiente</p>
                  <p className="font-medium">
                    {sriStatus.environment === "TEST"
                      ? "Pruebas"
                      : sriStatus.environment === "PRODUCTION"
                      ? "Produccion"
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Establecimientos</p>
                  <p className="font-medium">{sriStatus.establishmentCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Secuenciales</p>
                  <p className="font-medium">{sriStatus.sequenceCount}</p>
                </div>
              </div>
              <Button asChild variant={sriStatus.hasProfile ? "outline" : "default"} className="w-full">
                <Link href={routes.sri}>
                  {sriStatus.hasProfile ? "Abrir" : "Configurar"}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* ERP Avanzado */}
          <Card className={!plan.canRequestDedicatedErp ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">ERP Avanzado</CardTitle>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                  plan.canRequestDedicatedErp
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-slate-100 bg-slate-50 text-slate-400"
                }`}>
                  {plan.canRequestDedicatedErp ? "Disponible" : "Plan Pro requerido"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ERP dedicado con contabilidad, compras, inventario avanzado y reportes financieros.
              </p>
              {plan.canRequestDedicatedErp ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={routes.erp}>Abrir ERP</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link href={routes.billing}>Mejorar plan</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan summary */}
        <Card>
          <CardHeader>
            <CardTitle>Plan activo: {plan.planName}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 text-sm">
            <p className="text-muted-foreground">
              Productos: {basicReports.counts.products} / {plan.limits.products}
            </p>
            <p className="text-muted-foreground">
              Clientes: {basicReports.counts.customers} / {plan.limits.customers}
            </p>
            <p className="text-muted-foreground">
              Ventas: {basicReports.counts.receipts} / {plan.limits.receipts}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.billing}>Ver plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
