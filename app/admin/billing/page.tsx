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
          <p className="text-sm text-muted-foreground">Activaciones internas</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Planes y activaciones
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Administra plan comercial, modo operativo y features por tenant sin
            depender del formulario de solicitud de mejora.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.adminBillingUpgradeRequests}>
                Ver solicitudes antiguas ({pendingUpgradeCount} pendientes)
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
              <CardTitle>Control manual</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Cambios de plan, modo y overrides quedan auditados. Upgrade
              requests siguen visibles como historico o pendiente, pero ya no
              son el flujo principal.
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tenants, modos y activaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <BillingAdminTable tenants={tenants} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
