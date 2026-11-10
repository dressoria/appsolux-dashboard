"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

type Props = {
  priceId: string;
  planDisplayName: string;
  billingInterval: string;
  amount: number;
  customerEmail: string;
  checkoutIntentToken: string;
  checkoutIntentId: string;
  paddleEnv: "sandbox" | "production";
  clientToken: string;
};

export function PaddleCheckoutClient({
  priceId,
  planDisplayName,
  billingInterval,
  amount,
  customerEmail,
  checkoutIntentToken,
  checkoutIntentId,
  paddleEnv,
  clientToken,
}: Props) {
  const router = useRouter();
  const paddleRef = useRef<Paddle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "completed" | "error">("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const openedRef = useRef(false);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const openCheckout = useCallback((paddle: Paddle) => {
    if (openedRef.current) return;
    openedRef.current = true;
    setStatus("ready");

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: customerEmail },
      customData: { cid: checkoutIntentToken },
    });
  }, [priceId, customerEmail, checkoutIntentToken]);

  useEffect(() => {
    let cancelled = false;

    initializePaddle({
      environment: paddleEnv,
      token: clientToken,
      eventCallback(event) {
        if (event.name === "checkout.completed") {
          setStatus("completed");
          router.push(`/billing?intentId=${encodeURIComponent(checkoutIntentId)}`);
        }
        if (event.name === "checkout.closed") {
          if (statusRef.current !== "completed") {
            router.push(`/billing?intentId=${encodeURIComponent(checkoutIntentId)}`);
          }
        }
        if (event.name === "checkout.error") {
          setStatus("error");
          const detail = (event.data as Record<string, unknown> | undefined)?.error;
          if (typeof detail === "string") {
            setErrorDetail(detail);
          }
          if (process.env.NODE_ENV === "development") {
            console.error("[Paddle] checkout.error", event.data);
          }
        }
      },
    }).then((paddle) => {
      if (cancelled || !paddle) return;
      paddleRef.current = paddle;
      openCheckout(paddle);
    }).catch((err) => {
      if (!cancelled) {
        setStatus("error");
        if (process.env.NODE_ENV === "development") {
          console.error("[Paddle] initialization failed", err);
        }
      }
    });

    return () => { cancelled = true; };
  }, [paddleEnv, clientToken, openCheckout, router, checkoutIntentId]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      {status === "loading" && (
        <p className="text-muted-foreground">Preparando checkout para Plan {planDisplayName}…</p>
      )}
      {status === "ready" && (
        <p className="text-muted-foreground">
          Checkout de Plan {planDisplayName} ({billingInterval === "MONTHLY" ? "Mensual" : "Anual"} — ${amount} USD) abierto.
        </p>
      )}
      {status === "completed" && (
        <div className="rounded-xl border border-facturom-primary/25 bg-facturom-primary/5 p-6 text-center">
          <p className="font-semibold">Checkout completado. Estamos consultando la confirmación del proveedor.</p>
          <p className="mt-2 text-sm text-muted-foreground">Serás redirigido automáticamente.</p>
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-6 text-center">
          <p className="font-semibold text-destructive">No se pudo cargar el checkout.</p>
          {errorDetail ? (
            <p className="mt-2 text-sm text-muted-foreground">{errorDetail}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Verifica tu conexión e intenta de nuevo. Si el problema persiste, contacta a soporte.
            </p>
          )}
          <button
            className="mt-4 rounded-lg bg-facturom-primary px-4 py-2 text-sm font-medium text-white hover:bg-facturom-primary/90"
            onClick={() => router.push("/billing")}
            type="button"
          >
            Volver a planes
          </button>
        </div>
      )}
    </div>
  );
}
