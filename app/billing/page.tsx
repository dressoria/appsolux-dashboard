import Link from "next/link";

import { UpgradeRequestCard } from "@/components/appsolux/billing/upgrade-request-card";
import { StripeBillingActions } from "@/components/appsolux/billing/stripe-billing-actions";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings, isTenantOwner } from "@/lib/auth/permissions";
import { defaultPlanDefinitions, getTenantSubscription } from "@/lib/core/plans";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getTenantUpgradeRequests } from "@/lib/core/upgrade-requests";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getStripeBillingAvailability } from "@/lib/core/billing/stripe-config";

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

function formatDate(value?: Date | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
  }).format(value);
}

function getSubscriptionNotice(status: string) {
  if (status === "manual") {
    return "Plan activado manualmente durante la beta.";
  }

  if (status === "trialing") {
    return "Tu tenant esta en periodo de prueba.";
  }

  if (status === "past_due") {
    return "No pudimos procesar tu pago. Tu cuenta conserva acceso durante el periodo de gracia.";
  }

  if (status === "suspended") {
    return "Plan requerido. Tus datos anteriores siguen disponibles en modo lectura.";
  }

  if (status === "canceled") {
    return "Tu suscripcion esta cancelada. Tus datos anteriores siguen disponibles en modo lectura.";
  }

  return "Durante la beta, la activacion y cambios de plan se realizan manualmente por Appsolux.";
}

function getTrialWarning(status: string, trialEndsAt?: Date | null) {
  if (status !== "trialing" || !trialEndsAt) {
    return null;
  }

  return trialEndsAt.getTime() < Date.now()
    ? "Tu prueba terminó. Elige un plan para continuar usando Facturom."
    : null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
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
  const [tenantMode, upgradeRequests, subscription, query] = await Promise.all([
    getTenantModeState(tenant),
    getTenantUpgradeRequests(tenant.id),
    getTenantSubscription(tenant.id),
    searchParams,
  ]);
  const erpProvisioning = tenantMode.erpProvisioning;
  const pendingUpgrade = upgradeRequests.find(
    (request) => request.status === "pending"
  );
  const trialWarning = getTrialWarning(
    tenantMode.subscriptionStatus,
    tenantMode.trialEndsAt
  );
  const stripeAvailable = getStripeBillingAvailability().configured;

  return (
    <DashboardShell>
      <div className="space-y-6">
        {query.checkout === "success" ? (
          <p className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
            Estamos confirmando tu pago. El plan se activará cuando Stripe envíe la confirmación segura.
          </p>
        ) : query.checkout === "cancelled" ? (
          <p className="rounded-xl border bg-muted/40 p-4 text-sm">Checkout cancelado. No se realizó ningún cambio.</p>
        ) : null}
        <div>
          <p className="text-sm text-muted-foreground">Appsolux</p>
          <h1 className="text-3xl font-semibold tracking-tight">Mi plan</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Controla tu plan, ciclo de cobro y suscripción segura con Stripe.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Estado comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {getSubscriptionNotice(tenantMode.subscriptionStatus)}
            </p>
            <div className="grid gap-2 text-muted-foreground sm:grid-cols-2">
              <p>Fin de trial: {formatDate(tenantMode.trialEndsAt)}</p>
              <p>
                Fin de periodo: {formatDate(tenantMode.currentPeriodEndsAt)}
              </p>
              {subscription?.cancelAtPeriodEnd ? (
                <p>Cancelación programada · activo hasta {formatDate(subscription.currentPeriodEndsAt)}</p>
              ) : null}
            </div>
            {trialWarning ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                <p>{trialWarning}</p>
                {!stripeAvailable ? (
                  <Button asChild className="mt-3" size="sm" variant="outline">
                    <Link href="/contacto">Contactar soporte</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
            {pendingUpgrade ? (
              <p className="rounded-md border bg-muted/40 p-3">
                Solicitud en revision para plan {pendingUpgrade.requestedPlanKey}.
                El equipo Appsolux la revisara manualmente durante la beta.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Plan actual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{tenantMode.planName}</p>
              <p className="text-xs text-muted-foreground">
                Clave: {tenantMode.planKey}
              </p>
              <p className="text-xs text-muted-foreground">
                Estado: {tenantMode.subscriptionStatus}
              </p>
              <p className="text-xs text-muted-foreground">
                Trial: {formatDate(tenantMode.trialEndsAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                Periodo: {formatDate(tenantMode.currentPeriodEndsAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                Sistema Dedicado:{" "}
                {tenantMode.canRequestDedicatedErp ? "incluido" : "no incluido"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limites del plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Productos: {tenantMode.limits.products}</p>
              <p>Clientes: {tenantMode.limits.customers}</p>
              <p>Ventas/recibos: {tenantMode.limits.receipts}</p>
              <p>Creditos activos: {tenantMode.limits.activeCredits}</p>
              <p>Usuarios: {tenantMode.limits.users}</p>
              <p>Bodegas/locales: {tenantMode.limits.warehouses}</p>
              <p>Puntos de emisión: {tenantMode.limits.issuePoints}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>POS basico: {formatFeature(tenantMode.features.basic_pos)}</p>
              <p>
                Ventas fiadas: {formatFeature(tenantMode.features.basic_credit)}
              </p>
              <p>
                Reportes avanzados:{" "}
                {formatFeature(tenantMode.features.advanced_reports)}
              </p>
              <p>
                Sistema Dedicado: {formatFeature(tenantMode.features.dedicated_erp)}
              </p>
              <p>SRI: {formatFeature(tenantMode.features.sri)}</p>
              <p>
                Automatizaciones: {formatFeature(tenantMode.features.automations)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Planes Facturom</CardTitle>
          </CardHeader>
          <CardContent>
            {isTenantOwner(user) ? (
              <StripeBillingActions
                currentPlanCode={
                  tenantMode.planKey === "free"
                    ? "BASIC"
                    : tenantMode.planKey === "pro"
                      ? "BUSINESS"
                      : tenantMode.planKey === "enterprise"
                        ? "ENTERPRISE"
                        : null
                }
                currentInterval={subscription?.billingInterval ?? null}
                hasActiveStripeSubscription={Boolean(
                  tenantMode.subscriptionStatus === "active" && subscription?.stripeSubscriptionId
                )}
                hasStripeCustomer={Boolean(subscription?.stripeCustomerId)}
                onlinePaymentsAvailable={stripeAvailable}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Solo el owner puede contratar o cambiar el plan.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparacion rapida</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {Object.values(defaultPlanDefinitions).map((plan) => (
              <div key={plan.key} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{plan.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.limits.products} productos · {plan.limits.customers} clientes
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sistema Dedicado:{" "}
                  {plan.features.dedicated_erp === true ? "incluido" : "no incluido"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Solicitud de mejora de plan</CardTitle>
          </CardHeader>
          <CardContent>
            <UpgradeRequestCard
              planKey={tenantMode.planKey}
              requests={upgradeRequests}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {erpProvisioning.isRealActive
                ? "Sistema Dedicado activo"
                : erpProvisioning.isPending
                  ? "Sistema Dedicado en preparacion"
                  : tenantMode.canRequestDedicatedErp
                    ? "Solicitar Sistema Dedicado"
                    : "Mejora tu plan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {erpProvisioning.isRealActive
                ? "Tu Sistema Dedicado ya esta activo. Puedes operar en el modo avanzado y mantener el modo basico como respaldo."
                : erpProvisioning.isPending
                  ? "El Sistema Dedicado esta en preparacion. Puedes seguir vendiendo en Appsolux Basico mientras termina."
                  : tenantMode.canRequestDedicatedErp
                    ? "Tu plan permite solicitar una instancia dedicada para este tenant con inventario avanzado, POS completo y reportes conectados."
                    : "Tu plan actual usa el modo basico de Appsolux Core DB. Solicita activacion Pro para habilitar Sistema Dedicado, inventario avanzado, POS completo y reportes."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant={tenantMode.canRequestDedicatedErp ? "outline" : "default"}>
                <Link href={tenantMode.canRequestDedicatedErp ? routes.dashboard : routes.billing}>
                  {erpProvisioning.isRealActive
                    ? "Ir al dashboard"
                    : tenantMode.canRequestDedicatedErp
                      ? "Ver estado en dashboard"
                      : pendingUpgrade
                        ? "Solicitud en revision"
                        : "Solicitar activacion Pro"}
                </Link>
              </Button>
              {erpProvisioning.isRealActive ? (
                <>
                  <Button asChild variant="outline">
                    <Link href={routes.erp}>ERP avanzado</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.pos}>POS avanzado</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={routes.reports}>Reportes avanzados</Link>
                  </Button>
                </>
              ) : null}
              <Button asChild variant="outline">
                <Link href={routes.basic}>Seguir usando basico</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <ErpDedicatedProvisionCard
          provisioning={erpProvisioning}
          canManage={canManageSettings(user)}
          canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          blockedPlanMessage="Free/trial no crea Sistema Dedicado. Mejora tu plan para activar inventario avanzado, POS completo y reportes."
        />
      </div>
    </DashboardShell>
  );
}
