"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { commercialPricing } from "@/lib/core/billing/commercial-pricing";
import type { StripeBillingInterval, StripePlanCode } from "@/lib/core/billing/stripe-price-map";

type Props = {
  currentPlanCode: StripePlanCode | null;
  currentInterval: StripeBillingInterval | null;
  hasActiveStripeSubscription: boolean;
  hasStripeCustomer: boolean;
  onlinePaymentsAvailable: boolean;
};

export function StripeBillingActions(props: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function redirectFrom(endpoint: string, body?: Record<string, string>) {
    setLoading(endpoint + JSON.stringify(body ?? {}));
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
    <div className="space-y-4">
      {!props.onlinePaymentsAvailable ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Pagos en línea aún no disponibles.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {commercialPricing.map((plan) => {
          const current = props.hasActiveStripeSubscription && props.currentPlanCode === plan.code;
          return (
            <div className="rounded-xl border p-4" key={plan.code}>
              <p className="font-semibold">{plan.displayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ${plan.monthly} / mes · ${plan.yearly} / año
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["MONTHLY", "YEARLY"] as const).map((interval) => {
                  const samePlan = current && props.currentInterval === interval;
                  const key = "/api/billing/checkout" + JSON.stringify({ planCode: plan.code, billingInterval: interval });
                  return (
                    <Button
                      key={interval}
                      size="sm"
                      variant={interval === "MONTHLY" ? "default" : "outline"}
                      disabled={!props.onlinePaymentsAvailable || props.hasActiveStripeSubscription || loading !== null}
                      onClick={() => redirectFrom("/api/billing/checkout", { planCode: plan.code, billingInterval: interval })}
                    >
                      {samePlan
                        ? "Plan actual"
                        : props.hasActiveStripeSubscription
                          ? "Cambiar en portal"
                          : loading === key
                            ? "Abriendo…"
                            : interval === "MONTHLY"
                              ? "Elegir mensual"
                              : "Elegir anual"}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {props.onlinePaymentsAvailable && props.hasStripeCustomer ? (
        <Button variant="outline" disabled={loading !== null} onClick={() => redirectFrom("/api/billing/portal") }>
          Administrar suscripción
        </Button>
      ) : null}
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
