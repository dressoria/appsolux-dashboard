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
  tenantId: string;
  planCode: string;
  paddleEnv: "sandbox" | "production";
  clientToken: string;
};

export function PaddleCheckoutClient({
  priceId,
  planDisplayName,
  billingInterval,
  amount,
  customerEmail,
  tenantId,
  planCode,
  paddleEnv,
  clientToken,
}: Props) {
  const router = useRouter();
  const paddleRef = useRef<Paddle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "completed" | "error">("loading");
  const openedRef = useRef(false);

  const openCheckout = useCallback((paddle: Paddle) => {
    if (openedRef.current) return;
    openedRef.current = true;
    setStatus("ready");

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: customerEmail },
      customData: { tenantId, planCode, billingInterval },
    });
  }, [priceId, customerEmail, tenantId, planCode, billingInterval]);

  useEffect(() => {
    let cancelled = false;

    initializePaddle({
      environment: paddleEnv,
      token: clientToken,
      eventCallback(event) {
        if (event.name === "checkout.completed") {
          setStatus("completed");
          router.push("/billing?checkout=success");
        }
        if (event.name === "checkout.closed") {
          if (status !== "completed") {
            router.push("/billing?checkout=cancelled");
          }
        }
      },
    }).then((paddle) => {
      if (cancelled || !paddle) return;
      paddleRef.current = paddle;
      openCheckout(paddle);
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => { cancelled = true; };
  }, [paddleEnv, clientToken, openCheckout, router, status]);

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
          <p className="font-semibold">Pago recibido. Estamos confirmando tu suscripción.</p>
          <p className="mt-2 text-sm text-muted-foreground">Serás redirigido automáticamente.</p>
        </div>
      )}
      {status === "error" && (
        <p className="text-destructive">No se pudo cargar el checkout. Intenta de nuevo.</p>
      )}
    </div>
  );
}
