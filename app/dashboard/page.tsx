import Link from "next/link";

import { ChatwootProvisionCard } from "@/components/appsolux/dashboard/chatwoot-provision-card";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { EvolutionProvisionCard } from "@/components/appsolux/dashboard/evolution-provision-card";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getBasicMigrationSummary } from "@/lib/core/basic-to-erp-migration";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import { getTenantModeState } from "@/lib/core/tenant-mode";
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
  const [chatwootIntegration, evolutionIntegration, tenantMode, basicMigration] =
    await Promise.all([
      getChatwootIntegrationStatus(tenant.id),
      getTenantIntegrationByProvider(tenant.id, "evolution").catch(() => null),
      getTenantModeState(tenant),
      getBasicMigrationSummary(tenant.id),
    ]);
  const erpProvisioning = tenantMode.erpProvisioning;
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

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Appsolux</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Dashboard de {tenant.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tu entorno esta preparado. Desde aqui eliges entre modo basico Core
            DB y modo avanzado con ERP dedicado.
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
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">{tenantMode.planName}</p>
              <p className="text-xs text-muted-foreground">
                Estado: {tenantMode.subscriptionStatus}
              </p>
              <p className="text-xs text-muted-foreground">
                ERP dedicado:{" "}
                {tenantMode.canRequestDedicatedErp ? "incluido" : "no incluido"}
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
            provisioning={erpProvisioning}
            canManage={canManage}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
            blockedPlanMessage="Tu plan actual trabaja en modo basico. Mejora tu plan para solicitar ERP dedicado."
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {tenantMode.shouldUseAdvancedMode
                ? "ERP dedicado activo"
                : erpProvisioning.isPending
                  ? "ERP en preparacion"
                  : erpProvisioning.isSimulated
                    ? "ERP validado en simulacion"
                    : "Estas usando Appsolux Basico"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {tenantMode.shouldUseAdvancedMode
                ? "Tu tenant ya puede operar en el modo avanzado conectado al ERP dedicado."
                : erpProvisioning.isPending
                  ? "Puedes seguir vendiendo en el modo basico mientras el worker externo prepara el ERP dedicado."
                  : tenantMode.isFreeLike
                    ? "El modo basico incluido te permite vender, cobrar, manejar clientes, fiados, caja y stock en Core DB."
                    : "Tu plan permite ERP dedicado. Puedes solicitarlo y seguir usando el modo basico mientras se prepara."}
            </p>
            <div className="flex flex-wrap gap-2">
              {tenantMode.shouldUseAdvancedMode ? (
                <>
                  <Button asChild>
                    <Link href={routes.erp}>Ir a ERP avanzado</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.pos}>Ir a POS avanzado</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.reports}>Reportes avanzados</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.basic}>Modo basico</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild>
                    <Link href={routes.basic}>Ir al modo basico</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.basicPos}>Crear venta</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.basicProducts}>Crear producto</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.basicCash}>Ver caja</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.billing}>
                      {tenantMode.canRequestDedicatedErp
                        ? "Solicitar ERP dedicado"
                        : "Mejorar plan"}
                    </Link>
                  </Button>
                </>
              )}
            </div>
            {basicMigration.isReadyForFutureMigration ? (
              <p className="text-xs text-muted-foreground">
                Datos basicos listos para futura migracion:{" "}
                {basicMigration.products} productos, {basicMigration.customers}{" "}
                clientes y {basicMigration.openCreditSales} ventas fiadas abiertas.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
