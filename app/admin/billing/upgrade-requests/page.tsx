import Link from "next/link";

import { UpgradeRequestsTable } from "@/components/appsolux/admin/upgrade-requests-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import { listUpgradeRequestsForAdmin } from "@/lib/core/upgrade-requests";

export default async function AdminUpgradeRequestsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para revisar solicitudes de upgrade.
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

  const requests = await listUpgradeRequestsForAdmin();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Beta comercial</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Solicitudes de upgrade
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Aprueba o rechaza solicitudes de Pro/Enterprise. Aprobar cambia el
            plan del tenant a estado manual; no ejecuta provisioning ni pagos.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.adminBilling}>Volver a admin billing</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Solicitudes</CardTitle>
          </CardHeader>
          <CardContent>
            <UpgradeRequestsTable requests={requests} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
