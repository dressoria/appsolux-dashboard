import Link from "next/link";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { CommercialPlanCatalog } from "@/components/appsolux/billing/commercial-plan-catalog";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { getCommercialPlanByInternalKey } from "@/lib/core/billing/commercial-plans";
import { getStripeBillingAvailability } from "@/lib/core/billing/stripe-config";
import { getTenantSubscription } from "@/lib/core/plans";
import { getTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function formatDate(value?: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "long" }).format(value);
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return <DashboardShell><div className="space-y-3"><h1 className="text-3xl font-black tracking-tight">Inicia sesión para ver tu plan</h1><Button asChild><Link href="/sign-in">Iniciar sesión</Link></Button></div></DashboardShell>;
  }

  const tenant = await getCurrentTenant(user);
  const [subscription, access, query] = await Promise.all([
    getTenantSubscription(tenant.id),
    getTenantOperationalAccess(tenant.id),
    searchParams,
  ]);
  const plan = getCommercialPlanByInternalKey(subscription?.plan.key);
  const stripeAvailable = getStripeBillingAvailability().configured;
  const isTrial = subscription?.status === "trialing" && access.canOperate;
  const isSuspended = !access.canOperate;
  const trialDays = access.trialDaysRemaining ?? 0;

  return (
    <DashboardShell contentClassName="mx-auto max-w-7xl">
      <div className="space-y-10 pb-10">
        {query.checkout === "success" ? <p className="rounded-xl border border-facturom-primary/25 bg-facturom-primary/5 p-4 text-sm">Recibimos tu solicitud. Activaremos el plan cuando el pago quede confirmado.</p> : query.checkout === "cancelled" ? <p className="rounded-xl border bg-muted/40 p-4 text-sm">El proceso fue cancelado y no se realizó ningún cambio.</p> : null}

        <header className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-facturom-primary">Mi plan</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {isTrial ? `Estás probando Facturom ${plan.displayName}` : isSuspended ? "Tu prueba gratuita terminó" : `Plan ${plan.displayName}`}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {isTrial ? `Disfruta el plan Básico completo. Te quedan ${trialDays} ${trialDays === 1 ? "día" : "días"}.` : isSuspended ? "Tus datos siguen seguros y disponibles en modo lectura. Elige un plan para continuar facturando." : "Consulta lo que incluye tu plan y elige el ciclo de pago que mejor se adapte a tu negocio."}
          </p>
        </header>

        <Card className="overflow-hidden border-facturom-primary/20 bg-gradient-to-br from-facturom-primary/10 via-card to-card shadow-sm">
          <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black">{plan.displayName}</h2>
                {isTrial ? <span className="rounded-full bg-facturom-primary px-3 py-1 text-xs font-bold text-white">Prueba gratuita</span> : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.description}</p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-facturom-primary" />Facturas ilimitadas</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-facturom-primary" />Facturación electrónica SRI</span>
                {isTrial ? <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-facturom-primary" />{trialDays} días restantes</span> : null}
              </div>
            </div>
            <div className="rounded-2xl border bg-background/80 p-5">
              <p className="text-sm text-muted-foreground">{isTrial ? "Tu prueba finaliza" : "Ciclo actual"}</p>
              <p className="mt-1 text-lg font-bold">{isTrial ? formatDate(subscription?.trialEndsAt) ?? "Próximamente" : subscription?.billingInterval === "YEARLY" ? "Anual" : subscription?.billingInterval === "MONTHLY" ? "Mensual" : "Sin ciclo configurado"}</p>
              {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEndsAt ? <p className="mt-2 text-xs text-muted-foreground">Disponible hasta {formatDate(subscription.currentPeriodEndsAt)}</p> : null}
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3 text-center">
          <h2 className="text-3xl font-black tracking-tight">Elige el plan para tu negocio</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">Tres opciones claras, todas con facturas electrónicas ilimitadas y soporte para Ecuador.</p>
        </section>

        <CommercialPlanCatalog
          canManagePlan={isTenantOwner(user)}
          context="billing"
          currentInterval={subscription?.billingInterval ?? null}
          currentPlanCode={plan.code}
          hasActiveSubscription={Boolean(subscription?.status === "active" && subscription.stripeSubscriptionId)}
          hasBillingCustomer={Boolean(subscription?.stripeCustomerId)}
          onlinePaymentsAvailable={stripeAvailable}
        />

        {!stripeAvailable ? <div className="rounded-2xl border bg-muted/30 p-6 text-center"><h2 className="font-bold">¿Necesitas continuar ahora?</h2><p className="mt-2 text-sm text-muted-foreground">Nuestro equipo puede orientarte mientras habilitamos los pagos en línea.</p><Button asChild className="mt-4" variant="outline"><Link href="/contacto">Contactar soporte</Link></Button></div> : null}
      </div>
    </DashboardShell>
  );
}
