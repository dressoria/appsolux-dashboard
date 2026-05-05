import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function formatFeature(value: boolean | "manual" | "future") {
  if (value === true) {
    return "Incluido";
  }

  if (value === "manual") {
    return "Manual";
  }

  if (value === "future") {
    return "Futuro";
  }

  return "No incluido";
}

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver tu plan de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const planState = await getTenantPlanState(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Appsolux</p>
          <h1 className="text-3xl font-semibold tracking-tight">Mi plan</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Plan actual, limites iniciales y funciones disponibles para este
            tenant.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Plan actual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{planState.planName}</p>
              <p className="text-xs text-muted-foreground">
                Clave: {planState.planKey}
              </p>
              <p className="text-xs text-muted-foreground">
                Estado: {planState.status}
              </p>
              <p className="text-xs text-muted-foreground">
                ERP dedicado:{" "}
                {planState.canRequestDedicatedErp ? "incluido" : "no incluido"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limites basicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Productos: {planState.limits.products}</p>
              <p>Clientes: {planState.limits.customers}</p>
              <p>Ventas/recibos: {planState.limits.receipts}</p>
              <p>Pedidos abiertos: {planState.limits.openOrders}</p>
              <p>Creditos activos: {planState.limits.activeCredits}</p>
              <p>Usuarios: {planState.limits.users}</p>
              <p>Bodegas/locales: {planState.limits.warehouses}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>POS basico: {formatFeature(planState.features.basic_pos)}</p>
              <p>
                Ventas fiadas: {formatFeature(planState.features.basic_credit)}
              </p>
              <p>
                Reportes avanzados:{" "}
                {formatFeature(planState.features.advanced_reports)}
              </p>
              <p>ERP dedicado: {formatFeature(planState.features.dedicated_erp)}</p>
              <p>SRI: {formatFeature(planState.features.sri)}</p>
              <p>
                Automatizaciones: {formatFeature(planState.features.automations)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {planState.canRequestDedicatedErp
                ? "ERP dedicado disponible"
                : "Mejora tu plan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {planState.canRequestDedicatedErp
                ? "Tu plan permite solicitar un ERPNext dedicado para inventario avanzado, POS completo y reportes conectados."
                : "Tu plan actual usa el modo basico de Appsolux Core DB. Mejora tu plan para activar ERP dedicado, inventario avanzado, POS completo y reportes."}
            </p>
            <Button asChild size="sm">
              <Link href={planState.canRequestDedicatedErp ? "/dashboard" : "/settings"}>
                {planState.canRequestDedicatedErp
                  ? "Activar ERP dedicado"
                  : "Mejorar plan"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
