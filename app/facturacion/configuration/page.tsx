import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { ConfigurationPageClient } from "@/components/appsolux/settings/configuration-page-client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function ConfigurationPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesión requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesión para acceder a la configuración.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Empresa</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Configuración
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Ajusta el comportamiento del sistema, los comprobantes, la firma electrónica y más.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Empresa: {tenant.name}
          </p>
        </div>
        <ConfigurationPageClient />
      </div>
    </DashboardShell>
  );
}
