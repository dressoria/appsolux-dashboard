"use client";
import { useState } from "react";
import { ContractAcceptance } from "@/components/appsolux/legal/contract-acceptance";
import type { LegalProof } from "@/lib/legal/catalog";
import { Button } from "@/components/ui/button";
export function PaddleCheckoutReview({ planCode, billingInterval, amount, name, sandbox, changeExisting }: { planCode: string; billingInterval: string; amount: number; name: string; sandbox: boolean; changeExisting?: boolean }) {
  const [proof, setProof] = useState<LegalProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function start() {
    if (!proof || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode, billingInterval, legalProof: proof, operation: changeExisting ? "change" : "new" }) });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.message ?? "No se pudo iniciar la compra.");
      window.location.assign(body.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo continuar."); setBusy(false); }
  }
  return <div className="mx-auto max-w-2xl space-y-6"><h1 className="text-2xl font-bold">{changeExisting ? "Cambiar a" : "Contratar"} Plan {name}</h1>{changeExisting ? <p>La aceptación autoriza este plan y ciclo. Confirma el mismo precio en el portal; Paddle mostrará el prorrateo y la fecha efectiva antes de que confirmes el cambio. No crees otra suscripción.</p> : null}<p>${amount} USD / {billingInterval === "YEARLY" ? "año" : "mes"}. Paddle mostrará el total y los impuestos aplicables antes del pago. La renovación es automática hasta su cancelación desde el portal.</p>{sandbox ? <p className="rounded-xl border p-4">Entorno de prueba Sandbox. Esta operación no es un cobro real.</p> : null}<ContractAcceptance onChange={setProof} /><Button disabled={!proof || busy} onClick={start}>{busy ? "Preparando…" : changeExisting ? "Aceptar y revisar cambio en el portal" : "Aceptar e iniciar checkout"}</Button>{message ? <p role="alert">{message}</p> : null}</div>;
}
