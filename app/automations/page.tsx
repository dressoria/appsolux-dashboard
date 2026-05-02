import { AutomationList } from "@/components/appsolux/automations/automation-list";
import { AutomationSummary } from "@/components/appsolux/automations/automation-summary";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { demoAutomations } from "@/lib/automations/demo-automations";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function AutomationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver las automatizaciones de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const automations = demoAutomations.filter(
    (automation) => automation.tenant_id === tenant.id
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Automatizaciones</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Plantillas y configuraciones
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Aqui el cliente vera automatizaciones disponibles y formularios
            simples de configuracion con estados y resultados amigables.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tenant: {tenant.name}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Estas automatizaciones son datos demo y configuraciones base. Aun no
          ejecutan acciones, no guardan cambios y no conectan servicios internos.
        </div>

        <AutomationSummary automations={automations} />
        <AutomationList automations={automations} />
      </div>
    </DashboardShell>
  );
}
