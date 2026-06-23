"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";

export function SaleDetailActions({
  saleId,
  canCancel,
  canPay,
  pendingAmount,
  sriDocumentStatus,
}: {
  saleId: string;
  canCancel: boolean;
  canPay: boolean;
  pendingAmount: number;
  sriDocumentStatus?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function cancelSale() {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/basic/sales/${saleId}/cancel`, { method: "POST" });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "No se pudo cancelar venta.");
      setMessage("Venta cancelada.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cancelar.");
    }
  }

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/basic/sales/${saleId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: String(form.get("method") ?? "cash"),
          amount: Number(form.get("amount") ?? 0),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "No se pudo registrar abono.");
      setMessage("Abono registrado.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo registrar abono.");
    }
  }

  const sriBlocked =
    sriDocumentStatus === "AUTHORIZED" ||
    sriDocumentStatus === "SIGNED" ||
    sriDocumentStatus === "SENT";

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => window.print()}>
          Imprimir recibo
        </Button>
        <Button asChild variant="outline">
          <Link href={routes.basicSales}>Volver</Link>
        </Button>

        {canCancel && !sriBlocked && (
          <Button type="button" variant="destructive" onClick={cancelSale}>
            Cancelar venta
          </Button>
        )}

        {canCancel && sriDocumentStatus === "AUTHORIZED" && (
          <Button
            type="button"
            variant="outline"
            disabled
            title="La anulación SRI se realizará con nota de crédito en una fase posterior."
            className="border-amber-200 text-amber-700 opacity-60"
          >
            Anular factura SRI
          </Button>
        )}
      </div>

      {canCancel && (sriDocumentStatus === "SIGNED" || sriDocumentStatus === "SENT") && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          No se puede cancelar mientras la factura SRI está en proceso. Espera a que sea
          autorizada o rechazada.
        </p>
      )}

      {canPay && (
        <form
          onSubmit={addPayment}
          className="grid gap-3 rounded-md border p-3 md:grid-cols-[160px_160px_auto]"
        >
          <div className="space-y-1">
            <Label>Método</Label>
            <select name="method" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Abono</Label>
            <Input name="amount" type="number" step="0.01" min="0.01" max={pendingAmount} required />
          </div>
          <div className="flex items-end">
            <Button type="submit">Registrar abono</Button>
          </div>
        </form>
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
