"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  calculateAnnualSavings,
  commercialComparisonRows,
  commercialPlans,
  type CommercialPlanCode,
} from "@/lib/core/billing/commercial-plans";
import { cn } from "@/lib/utils";

type BillingInterval = "MONTHLY" | "YEARLY";

type Props = {
  context: "billing" | "public";
  onlinePaymentsAvailable?: boolean;
  currentPlanCode?: CommercialPlanCode | null;
  currentInterval?: BillingInterval | null;
  hasActiveSubscription?: boolean;
  hasBillingCustomer?: boolean;
  canManagePlan?: boolean;
};

function displayValue(value: string | boolean) {
  if (value === true) return <Check aria-label="Incluido" className="mx-auto size-4 text-facturom-primary" />;
  if (value === false) return <Minus aria-label="No incluido" className="mx-auto size-4 text-muted-foreground/50" />;
  return value;
}

export function CommercialPlanCatalog({
  context,
  onlinePaymentsAvailable = false,
  currentPlanCode = null,
  currentInterval = null,
  hasActiveSubscription = false,
  hasBillingCustomer = false,
  canManagePlan = false,
}: Props) {
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function redirectFrom(endpoint: string, body?: Record<string, string>) {
    const requestKey = endpoint + JSON.stringify(body ?? {});
    setLoading(requestKey);
    setMessage(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as { url?: string; message?: string };
    if (!response.ok || !payload.url) {
      setMessage(payload.message ?? "No se pudo continuar.");
      setLoading(null);
      return;
    }
    window.location.assign(payload.url);
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex rounded-xl border bg-muted/50 p-1" aria-label="Ciclo de pago">
          {(["MONTHLY", "YEARLY"] as const).map((option) => (
            <button
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-semibold transition-colors",
                interval === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              key={option}
              onClick={() => setInterval(option)}
              type="button"
            >
              {option === "MONTHLY" ? "Mensual" : "Anual"}
            </button>
          ))}
        </div>
        {interval === "YEARLY" ? <p className="text-sm font-medium text-facturom-primary">Ahorra pagando anualmente</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {commercialPlans.map((plan) => {
          const price = interval === "MONTHLY" ? plan.monthly : plan.yearly;
          const isCurrent = currentPlanCode === plan.code;
          const requestKey = "/api/billing/checkout" + JSON.stringify({ planCode: plan.code, billingInterval: interval });
          return (
            <article
              className={cn(
                "relative flex min-w-0 flex-col rounded-3xl border bg-card p-6 shadow-sm sm:p-7",
                plan.highlighted && "border-facturom-primary shadow-[0_18px_45px_-24px_var(--facturom-primary)] lg:-translate-y-2"
              )}
              key={plan.code}
            >
              {plan.badge ? (
                <span className="absolute -top-3 left-6 rounded-full bg-facturom-primary px-3 py-1 text-[11px] font-black tracking-wide text-white">
                  {plan.badge}
                </span>
              ) : null}
              <div className="min-h-28">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black tracking-tight">{plan.displayName}</h3>
                  {isCurrent && context === "billing" ? (
                    <span className="rounded-full bg-facturom-primary/10 px-2.5 py-1 text-xs font-bold text-facturom-primary">Tu plan</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.description}</p>
              </div>
              <div className="mt-5 border-y py-5">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black tracking-tight">${price}</span>
                  <span className="pb-1 text-sm text-muted-foreground">USD / {interval === "MONTHLY" ? "mes" : "año"}</span>
                </div>
                {interval === "YEARLY" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ahorras ${calculateAnnualSavings(plan.monthly, plan.yearly)} al año
                  </p>
                ) : null}
              </div>
              <ul className="my-6 flex-1 space-y-3">
                {plan.highlights.map((feature) => (
                  <li className="flex gap-2.5 text-sm leading-5" key={feature}>
                    <Check className="mt-0.5 size-4 shrink-0 text-facturom-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {context === "public" ? (
                <Button asChild className="w-full rounded-xl" variant={plan.highlighted ? "default" : "outline"}>
                  <Link href="/sign-up">Probar gratis 7 días</Link>
                </Button>
              ) : (
                <Button
                  className="w-full rounded-xl"
                  disabled={!onlinePaymentsAvailable || !canManagePlan || hasActiveSubscription || loading !== null}
                  onClick={() => redirectFrom("/api/billing/checkout", { planCode: plan.code, billingInterval: interval })}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {!onlinePaymentsAvailable
                    ? "Pagos próximamente"
                    : !canManagePlan
                      ? "Solo disponible para el propietario"
                      : isCurrent && hasActiveSubscription && currentInterval === interval
                        ? "Plan actual"
                        : hasActiveSubscription
                          ? "Cambiar desde el portal"
                          : loading === requestKey
                            ? "Abriendo…"
                            : "Elegir plan"}
                </Button>
              )}
            </article>
          );
        })}
      </div>

      {context === "billing" && onlinePaymentsAvailable && hasBillingCustomer ? (
        <div className="flex justify-center">
          <Button
            disabled={loading !== null}
            onClick={() => redirectFrom("/api/billing/portal")}
            variant="outline"
          >
            Administrar suscripción
          </Button>
        </div>
      ) : null}
      {context === "billing" && !onlinePaymentsAvailable ? (
        <p className="text-center text-sm text-muted-foreground">
          El pago en línea aún no está disponible. Puedes revisar todos los planes o contactar a soporte.
        </p>
      ) : null}
      {message ? <p className="text-center text-sm text-destructive" role="alert">{message}</p> : null}

      <section aria-labelledby="comparison-title" className="space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight" id="comparison-title">Compara los planes</h2>
          <p className="mt-2 text-sm text-muted-foreground">Todos incluyen facturación electrónica SRI y facturas ilimitadas.</p>
        </div>
        <div className="space-y-4 lg:hidden">
          {commercialPlans.map((plan) => (
            <div className="rounded-2xl border bg-card p-5" key={plan.code}>
              <h3 className="font-bold">{plan.displayName}</h3>
              <dl className="mt-4 space-y-2">
                {commercialComparisonRows.map((row) => (
                  <div className="flex items-center justify-between gap-4 border-t pt-2 text-sm" key={row.key}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-right font-medium">{displayValue(plan.comparison[row.key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-2xl border bg-card lg:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-1/4 px-5 py-4 text-left font-semibold">Función</th>
                {commercialPlans.map((plan) => <th className="px-4 py-4 text-center font-bold" key={plan.code}>{plan.displayName}</th>)}
              </tr>
            </thead>
            <tbody>
              {commercialComparisonRows.map((row) => (
                <tr className="border-t" key={row.key}>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">{row.label}</th>
                  {commercialPlans.map((plan) => (
                    <td className="px-4 py-3 text-center font-medium" key={plan.code}>{displayValue(plan.comparison[row.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
