"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
type Status = { state: string; intentId?: string; planCode?: string; billingInterval?: string; environment?: string; paymentConfirmedAt?: string; subscription?: { currentPeriodStartsAt: string | null; currentPeriodEndsAt: string | null; cancelAtPeriodEnd: boolean } | null };
const messages: Record<string, string> = {
  initiated: "Checkout iniciado. Aún no existe confirmación del proveedor.",
  provider_received: "Notificación recibida de Paddle. Estamos verificando la suscripción.",
  activation_pending: "Paddle confirmó el pago. La activación de la suscripción está pendiente.",
  active: "Plan activado. La suscripción fue validada en el servidor.",
  incident: "La confirmación o activación tiene una incidencia. Contacta con soporte e indica la referencia de checkout.",
  confirmation_missing: "No se recibió confirmación de activación. Si completaste el pago, consulta con soporte antes de realizar otra compra.",
  past_due: "Paddle informa un pago pendiente. Revisa el medio de pago desde el portal.",
  suspended: "Suscripción pausada o suspendida.", canceled: "Suscripción cancelada.", trialing: "Suscripción de prueba validada por Paddle.",
};
export function BillingActivationStatus({ intentId }: { intentId?: string }) {
  const router = useRouter();
  const refreshed = useRef<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  const applyStatus = useCallback((data: Status) => {
    setStatus(data);
    setError(false);
    if (data.state === "active" && refreshed.current !== (data.intentId ?? "current")) {
      refreshed.current = data.intentId ?? "current";
      router.refresh();
    }
  }, [router]);
  const load = useCallback(async () => {
    try { const response = await fetch(`/api/billing/status${intentId ? `?intentId=${encodeURIComponent(intentId)}` : ""}`, { cache: "no-store" }); if (!response.ok) throw new Error(); applyStatus(await response.json()); } catch { setError(true); }
  }, [intentId, applyStatus]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/billing/status${intentId ? `?intentId=${encodeURIComponent(intentId)}` : ""}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Status>; })
      .then(applyStatus)
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    const timer = window.setInterval(() => void load(), 8000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [load, intentId, applyStatus]);
  if (!error && (!status || status.state === "no_checkout")) return null;
  const date = (value: string | null) => value ? new Intl.DateTimeFormat("es-EC", { dateStyle: "long" }).format(new Date(value)) : "Por confirmar";
  return <section className="space-y-3 rounded-xl border bg-card p-5" aria-live="polite"><h2 className="font-bold">Estado de contratación</h2><p>{error ? "No se pudo consultar el estado. Vuelve a consultarlo; no es necesario iniciar otra compra." : messages[status!.state] ?? "Confirmación pendiente."}</p>{status?.planCode ? <p>Plan {status.planCode} · {status.billingInterval === "YEARLY" ? "Anual" : "Mensual"}</p> : null}{status?.environment === "sandbox" ? <p className="text-sm">Sandbox: {status.paymentConfirmedAt ? "pago de prueba completado y confirmado por Paddle" : "checkout de prueba, sin cobro real"}.</p> : null}{status?.subscription ? <p>Inicio: {date(status.subscription.currentPeriodStartsAt)} · Vencimiento: {date(status.subscription.currentPeriodEndsAt)}{status.subscription.cancelAtPeriodEnd ? " · Cancelación programada al vencimiento" : ""}</p> : null}{intentId ? <p className="break-all text-xs">Referencia: {intentId}</p> : null}<Button type="button" variant="outline" onClick={() => void load()}>Consultar estado nuevamente</Button></section>;
}
