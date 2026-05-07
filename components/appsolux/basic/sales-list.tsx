"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Sale = {
  id: string;
  createdAt: string | Date;
  total: string;
  status: string;
  paymentStatus: string;
  customer?: { name: string } | null;
  items: Array<{ quantity: number; product: { name: string } }>;
  payments: Array<{ method: string; amount: string }>;
};

function money(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function paidAmount(sale: Sale) {
  return sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export function SalesList({ sales }: { sales: Sale[] }) {
  const router = useRouter();
  const [paymentSaleId, setPaymentSaleId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function cancelSale(saleId: string) {
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/basic/sales/${saleId}/cancel`, {
        method: "POST",
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo cancelar venta.");
      }

      setMessage("Venta cancelada.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cancelar.");
    }
  }

  async function addPayment(event: FormEvent<HTMLFormElement>, saleId: string) {
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

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo registrar abono.");
      }

      setPaymentSaleId("");
      setMessage("Abono registrado.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo registrar abono.");
    }
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {sales.map((sale) => {
        const paid = paidAmount(sale);
        const pending = Math.max(Number(sale.total) - paid, 0);
        const canPay = sale.status !== "canceled" && pending > 0;

        return (
          <div key={sale.id} className="space-y-3 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {money(sale.total)} · {sale.paymentStatus}
                </p>
                <p className="text-muted-foreground">
                  {new Date(sale.createdAt).toLocaleString("es-EC")} ·{" "}
                  {sale.customer?.name ?? "Consumidor final"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sale.items
                    .map((item) => `${item.product.name} x${item.quantity}`)
                    .join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pagado {money(paid)} · pendiente {money(pending)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" asChild>
                  <Link href={`/basic/sales/${sale.id}`}>Ver recibo</Link>
                </Button>
                {canPay ? (
                  <Button type="button" variant="outline" onClick={() => setPaymentSaleId(paymentSaleId === sale.id ? "" : sale.id)}>
                    Abonar
                  </Button>
                ) : null}
                {sale.status !== "canceled" ? (
                  <Button type="button" variant="destructive" onClick={() => cancelSale(sale.id)}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </div>

            {paymentSaleId === sale.id ? (
              <form onSubmit={(event) => addPayment(event, sale.id)} className="grid gap-3 md:grid-cols-[160px_160px_auto]">
                <div className="space-y-1">
                  <Label>Metodo</Label>
                  <select name="method" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Monto</Label>
                  <Input name="amount" type="number" min="0.01" step="0.01" max={pending} required />
                </div>
                <div className="flex items-end">
                  <Button type="submit">Registrar abono</Button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      {sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay ventas para mostrar.</p>
      ) : null}
    </div>
  );
}
