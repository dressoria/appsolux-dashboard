import Link from "next/link";

import { BillingAdminTable } from "@/components/appsolux/admin/billing-admin-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import { listTenantBillingStates } from "@/lib/core/billing-admin";
import { listUpgradeRequestsForAdmin } from "@/lib/core/upgrade-requests";

export default async function AdminBillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para administrar planes beta.
          </p>
        </div>
      </DashboardShell>
    );
  }

  try {
    assertInternalAdmin(user);
  } catch {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Admin interno requerido
          </h1>
          <p className="text-muted-foreground">
            Esta pantalla solo esta disponible para administradores internos de
            Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const [tenants, upgradeRequests] = await Promise.all([
    listTenantBillingStates(),
    listUpgradeRequestsForAdmin(),
  ]);
  const pendingUpgradeCount = upgradeRequests.filter(
    (request) => request.status === "pending"
  ).length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Beta comercial</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Admin billing
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Activa planes manualmente durante la beta. No hay pasarela de pagos
            conectada y esta pantalla no modifica limites o features arbitrarias.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.adminBillingUpgradeRequests}>
                Ver solicitudes de upgrade ({pendingUpgradeCount} pendientes)
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Tenants</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {tenants.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes pendientes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {pendingUpgradeCount}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Beta manual</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Cambios de plan y aprobaciones quedan auditados. Pago en linea se
              integra en una fase posterior.
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tenants y suscripciones</CardTitle>
          </CardHeader>
          <CardContent>
            <BillingAdminTable tenants={tenants} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
