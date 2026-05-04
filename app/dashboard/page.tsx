import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { ChatwootProvisionCard } from "@/components/appsolux/dashboard/chatwoot-provision-card";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { EvolutionProvisionCard } from "@/components/appsolux/dashboard/evolution-provision-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

async function getChatwootIntegrationStatus(tenantId: string) {
  try {
    return await getTenantIntegrationByProvider(tenantId, "chatwoot");
  } catch {
    return null;
  }
}

function getChatwootOperationalAccess(config: unknown) {
  if (!config || typeof config !== "object") {
    return "missing";
  }

  const operationalAccess = (config as Record<string, unknown>)
    .operationalAccess;

  return operationalAccess === "ready" ? "ready" : "missing";
}

function getConfigString(config: unknown, key: string) {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const value = (config as Record<string, unknown>)[key];

  return typeof value === "string" ? value : undefined;
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
  const canManage = canManageSettings(user);

  const chatwootIntegration = await getChatwootIntegrationStatus(tenant.id);
  const evolutionIntegration = await getTenantIntegrationByProvider(
    tenant.id,
    "evolution"
  ).catch(() => null);
  const erpProvisioning = await getErpProvisioningState(tenant);

  const chatwootAccountId = Number(
    chatwootIntegration?.externalAccountId ?? tenant.chatwoot_account_id
  );

  const evolutionInstance =
    evolutionIntegration?.externalInstanceName ??
    tenant.channels.evolution?.instance_name ??
    "Sin instancia";

  const evolutionStatus =
    getConfigString(evolutionIntegration?.config, "connectionStatus") ??
    tenant.channels.evolution?.status ??
    "disconnected";
  const evolutionBridgeStatus = getConfigString(
    evolutionIntegration?.config,
    "bridgeStatus"
  );

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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            operationalAccess={getChatwootOperationalAccess(
              chatwootIntegration?.config
            )}
            lastError={chatwootIntegration?.lastError ?? undefined}
            canManage={canManage}
          />

          <EvolutionProvisionCard
            instanceName={
              evolutionInstance === "Sin instancia"
                ? undefined
                : evolutionInstance
            }
            status={evolutionStatus}
            bridgeStatus={evolutionBridgeStatus}
            canManage={canManage}
          />

          <ErpDedicatedProvisionCard
            status={erpProvisioning.status}
            desiredSiteName={erpProvisioning.desiredSiteName}
            desiredCompanyName={erpProvisioning.desiredCompanyName}
            latestJobId={erpProvisioning.latestJobId}
            lastError={erpProvisioning.lastError}
            canManage={canManage}
          />
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
