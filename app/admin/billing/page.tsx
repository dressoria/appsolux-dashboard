import { BillingAdminTable } from "@/components/appsolux/admin/billing-admin-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import { listTenantBillingStates } from "@/lib/core/billing-admin";

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

  const tenants = await listTenantBillingStates();

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
