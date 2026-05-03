import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { ChatwootProvisionCard } from "@/components/appsolux/dashboard/chatwoot-provision-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

async function getChatwootIntegrationStatus(tenantId: string) {
  try {
    return await getTenantIntegrationByProvider(tenantId, "chatwoot");
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver tu dashboard de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const chatwootIntegration = await getChatwootIntegrationStatus(tenant.id);
  const chatwootAccountId = Number(
    chatwootIntegration?.externalAccountId ?? tenant.chatwoot_account_id
  );

  const evolutionInstance =
    tenant.channels.evolution?.instance_name ?? "Sin instancia";

  const evolutionStatus =
    tenant.channels.evolution?.status ?? "disconnected";

  const subscriptionPlan = tenant.subscription?.plan ?? "Sin plan";
  const subscriptionStatus = tenant.subscription?.status ?? "Sin estado";

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Appsolux</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Dashboard de {tenant.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tu entorno esta preparado. Desde aqui conectaremos conversaciones,
            canales, automatizaciones, notificaciones y ERP.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{tenant.name}</p>
              <p className="text-xs text-muted-foreground">{tenant.slug}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{subscriptionPlan}</p>
              <p className="text-xs text-muted-foreground">
                {subscriptionStatus}
              </p>
            </CardContent>
          </Card>

          <ChatwootProvisionCard
            accountId={chatwootAccountId}
            status={chatwootIntegration?.status ?? "none"}
            lastError={chatwootIntegration?.lastError ?? undefined}
            canManage={canManageSettings(user)}
          />

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{evolutionInstance}</p>
              <p className="text-xs text-muted-foreground">
                Estado: {evolutionStatus}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Conversaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Se consultaran desde Chatwoot usando el account ID dinamico del
                tenant autenticado.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Canales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                WhatsApp, Instagram, Messenger, Evolution API y Meta.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ERP</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Clientes, inventario, ventas, facturacion, compras y
                contabilidad.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
