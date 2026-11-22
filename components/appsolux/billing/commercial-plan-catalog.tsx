"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Minus, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  calculateAnnualSavings,
  commercialComparisonCategories,
  commercialPlans,
  type CommercialPlanCode,
} from "@/lib/core/billing/commercial-plans";
import { cn } from "@/lib/utils";

import styles from "./commercial-plan-catalog.module.css";

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
  if (value === true)
    return (
      <Check
        aria-label="Incluido"
        className="mx-auto size-4 text-facturom-primary"
      />
    );
  if (value === false)
    return (
      <Minus
        aria-label="No incluido"
        className="mx-auto size-4 text-muted-foreground/50"
      />
    );
  return value;
}

function cardVariant(
  code: string,
  highlighted: boolean,
): string {
  if (highlighted) return styles.cardHighlighted;
  if (code === "ENTERPRISE") return styles.cardEnterprise;
  return styles.cardBasic;
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
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  async function redirectFrom(endpoint: string, body?: Record<string, string>) {
    const requestKey = endpoint + JSON.stringify(body ?? {});
    setLoading(requestKey);
    setMessage(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as {
      url?: string;
      message?: string;
    };
    if (!response.ok || !payload.url) {
      setMessage(payload.message ?? "No se pudo continuar.");
      setLoading(null);
      return;
    }
    window.location.assign(payload.url);
  }

  return (
    <div className="space-y-14">
      {/* Unlimited billing banner */}
      <div className="flex justify-center">
        <span className={styles.unlimitedBanner}>
          <Zap className="size-4 text-[#FF0099]" />
          Facturación electrónica ilimitada en todos los planes
        </span>
      </div>

      {/* Billing interval toggle */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="inline-flex rounded-xl border bg-muted/50 p-1"
          aria-label="Ciclo de pago"
        >
          {(["MONTHLY", "YEARLY"] as const).map((option) => (
            <button
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-semibold transition-colors",
                interval === option
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              key={option}
              onClick={() => setInterval(option)}
              type="button"
            >
              {option === "MONTHLY" ? "Mensual" : "Anual"}
            </button>
          ))}
        </div>
        {interval === "YEARLY" ? (
          <p className="text-sm font-medium text-[#FF0099]">
            Ahorra pagando anualmente
          </p>
        ) : null}
      </div>

      {/* Plan cards */}
      <div className="grid gap-8 lg:grid-cols-3">
        {commercialPlans.map((plan) => {
          const price = interval === "MONTHLY" ? plan.monthly : plan.yearly;
          const isCurrent = currentPlanCode === plan.code;
          return (
            <article
              className={cn(
                "relative flex min-w-0 flex-col rounded-3xl border bg-card p-6 sm:p-7",
                styles.card,
                cardVariant(plan.code, plan.highlighted),
                plan.highlighted &&
                  "border-[#FF0099] shadow-[0_18px_45px_-24px_rgba(255,0,153,0.25)] lg:-translate-y-2",
              )}
              key={plan.code}
            >
              {plan.badge ? (
                <span className={styles.badge}>{plan.badge}</span>
              ) : null}
              {isCurrent && context === "billing" ? (
                <span className={styles.currentBadge}>Tu plan</span>
              ) : null}

              <div className={styles.cardContent}>
                <div className="min-h-24">
                  <h3
                    className={cn(
                      "text-2xl font-black tracking-tight",
                      plan.highlighted
                        ? "text-[#000345]"
                        : "text-[#000345]",
                    )}
                  >
                    {plan.displayName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mt-5 border-y py-5">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black tracking-tight text-[#000345]">
                      ${price}
                    </span>
                    <span className="pb-1 text-sm text-muted-foreground">
                      USD / {interval === "MONTHLY" ? "mes" : "año"}
                    </span>
                  </div>
                  {interval === "YEARLY" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ahorras ${calculateAnnualSavings(plan.monthly, plan.yearly)}{" "}
                      al año
                    </p>
                  ) : null}
                  <p className={styles.priceNote}>
                    Precio antes de impuestos
                  </p>
                </div>

                {/* Highlights */}
                <ul className="my-6 flex-1 space-y-3">
                  {plan.highlights.map((feature) => (
                    <li
                      className="flex gap-2.5 text-sm leading-5"
                      key={feature}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          plan.highlighted
                            ? "text-[#FF0099]"
                            : "text-facturom-primary",
                        )}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA buttons */}
                {context === "public" ? (
                  <Button
                    asChild
                    className={cn(
                      "w-full rounded-xl",
                      plan.highlighted &&
                        "bg-[#000345] text-white hover:bg-[#000345]/90",
                    )}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    <Link href="/sign-up">Probar gratis 7 días</Link>
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      className={cn(
                        "w-full rounded-xl",
                        plan.highlighted &&
                          "bg-[#000345] text-white hover:bg-[#000345]/90",
                      )}
                      disabled={
                        !onlinePaymentsAvailable ||
                        !canManagePlan ||
                        (hasActiveSubscription &&
                          isCurrent &&
                          currentInterval === interval) ||
                        loading !== null
                      }
                      onClick={() =>
                        router.push(
                          `/billing/paddle/checkout?planCode=${plan.code}&billingInterval=${interval}`,
                        )
                      }
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {!onlinePaymentsAvailable
                        ? "Pagos próximamente"
                        : !canManagePlan
                          ? "Solo disponible para el propietario"
                          : isCurrent &&
                              hasActiveSubscription &&
                              currentInterval === interval
                            ? "Plan actual"
                            : hasActiveSubscription
                              ? "Revisar cambio de plan"
                              : loading !== null
                                ? "Abriendo…"
                                : "Elegir plan"}
                    </Button>
                    {canManagePlan && !hasActiveSubscription ? (
                      <Button
                        className="w-full rounded-xl"
                        disabled={loading !== null}
                        onClick={() =>
                          router.push(
                            `/billing/transfer?plan=${plan.code}&interval=${interval}`,
                          )
                        }
                        variant="ghost"
                        size="sm"
                      >
                        Pagar por transferencia
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Billing portal / messages */}
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
          El pago en línea aún no está disponible. Puedes revisar todos los
          planes o contactar a soporte.
        </p>
      ) : null}
      {message ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      {/* Comparison section — collapsible */}
      <section aria-labelledby="comparison-title" className="space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h2
              className="text-2xl font-black tracking-tight text-[#000345]"
              id="comparison-title"
            >
              Comparar todas las funcionalidades
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Todos incluyen facturación electrónica SRI y documentos
              ilimitados.
            </p>
          </div>
          <button
            className={styles.comparisonToggle}
            onClick={() => setComparisonOpen((prev) => !prev)}
            type="button"
            aria-expanded={comparisonOpen}
            aria-controls="comparison-content"
          >
            {comparisonOpen ? "Ocultar comparación" : "Ver comparación detallada"}
            <ChevronDown
              className={cn(
                styles.comparisonChevron,
                comparisonOpen && styles.comparisonChevronOpen,
              )}
            />
          </button>
        </div>

        <div
          className={cn(
            styles.comparisonBody,
            comparisonOpen && styles.comparisonBodyOpen,
          )}
          id="comparison-content"
        >
          <div className={styles.comparisonInner}>
            {/* Mobile: stacked cards */}
            <div className="space-y-4 lg:hidden">
              {commercialPlans.map((plan) => (
                <div className="rounded-2xl border bg-card p-5" key={plan.code}>
                  <h3 className="font-bold text-[#000345]">
                    {plan.displayName}
                  </h3>
                  {commercialComparisonCategories.map((cat) => (
                    <div key={cat.category} className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-facturom-primary">
                        {cat.category}
                      </p>
                      <dl className="space-y-1">
                        {cat.rows.map((row) => (
                          <div
                            className="flex items-center justify-between gap-4 border-t py-2 text-sm"
                            key={row.key}
                          >
                            <dt className="text-muted-foreground">
                              {row.label}
                            </dt>
                            <dd className="text-right font-medium">
                              {displayValue(plan.comparison[row.key])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Desktop: table with category headers */}
            <div className="hidden overflow-hidden rounded-2xl border bg-card lg:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-[30%] px-5 py-4 text-left font-semibold text-[#000345]">
                      Función
                    </th>
                    {commercialPlans.map((plan) => (
                      <th
                        className={cn(
                          "px-4 py-4 text-center font-bold",
                          plan.highlighted
                            ? "text-[#FF0099]"
                            : "text-[#000345]",
                        )}
                        key={plan.code}
                      >
                        {plan.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commercialComparisonCategories.map((cat) => (
                    <Fragment key={cat.category}>
                      <tr>
                        <td
                          className={cn(
                            styles.categoryHeader,
                            "px-5 py-2.5",
                          )}
                          colSpan={4}
                        >
                          {cat.category}
                        </td>
                      </tr>
                      {cat.rows.map((row) => (
                        <tr className="border-t" key={row.key}>
                          <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                            {row.label}
                          </th>
                          {commercialPlans.map((plan) => (
                            <td
                              className="px-4 py-3 text-center font-medium"
                              key={plan.code}
                            >
                              {displayValue(plan.comparison[row.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
