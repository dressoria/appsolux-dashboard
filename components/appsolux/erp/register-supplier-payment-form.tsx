"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextModeOfPayment, ErpnextPaymentEntry, ErpnextPurchaseInvoice } from "@/types/erpnext";

type Props = {
  pendingInvoices: ErpnextPurchaseInvoice[];
  modesOfPayment: ErpnextModeOfPayment[];
};

type PaySupplierResponse = ApiResponse<{ payment_entry: ErpnextPaymentEntry }>;

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value ?? 0);
}

export function RegisterSupplierPaymentForm({ pendingInvoices, modesOfPayment }: Props) {
  const router = useRouter();
  const activeModes = modesOfPayment.filter((m) => m.enabled === 1 || m.enabled === true);

  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [amount, setAmount] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState(activeModes[0]?.name ?? "");
  const [referenceNo, setReferenceNo] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const invoice = pendingInvoices.find((inv) => inv.name === selectedInvoice);
  const outstanding = invoice?.outstanding_amount ?? 0;

  function handleInvoiceChange(name: string) {
    setSelectedInvoice(name);
    const inv = pendingInvoices.find((i) => i.name === name);
    if (inv) setAmount(String(inv.outstanding_amount ?? ""));
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    const paidAmount = parseFloat(amount);

    if (!selectedInvoice) {
      setIsError(true);
      setMessage("Selecciona una factura.");
      setIsPending(false);
      return;
    }

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      setIsError(true);
      setMessage("El monto debe ser mayor a 0.");
      setIsPending(false);
      return;
    }

    if (paidAmount > outstanding) {
      setIsError(true);
      setMessage(`El monto no puede superar el saldo pendiente (${formatMoney(outstanding)}).`);
      setIsPending(false);
      return;
    }

    if (!modeOfPayment) {
      setIsError(true);
      setMessage("Selecciona un metodo de pago.");
      setIsPending(false);
      return;
    }

    try {
      const res = await fetch("/api/erpnext/purchases/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_invoice_name: selectedInvoice,
          paid_amount: paidAmount,
          mode_of_payment: modeOfPayment,
          reference_no: referenceNo || undefined,
        }),
      });
      const result = (await res.json()) as PaySupplierResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Pago ${result.data.payment_entry.name} registrado correctamente.`);
      setSelectedInvoice("");
      setAmount("");
      setReferenceNo("");
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo registrar el pago.");
    } finally {
      setIsPending(false);
    }
  }

  if (pendingInvoices.length === 0) return null;

  if (activeModes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registrar pago a proveedor</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Configura una cuenta de caja o banco para un metodo de pago antes de registrar pagos a
            proveedores.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar pago a proveedor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="supplier-invoice">Factura pendiente</Label>
            <select
              id="supplier-invoice"
              value={selectedInvoice}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecciona una factura...</option>
              {pendingInvoices.map((inv) => (
                <option key={inv.name} value={inv.name}>
                  {inv.name} — {inv.supplier_name ?? inv.supplier} —{" "}
                  {formatMoney(inv.outstanding_amount)} pendiente
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="supplier-amount">Monto a pagar</Label>
            <Input
              id="supplier-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={outstanding > 0 ? outstanding : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {invoice ? (
              <p className="text-xs text-muted-foreground">
                Saldo pendiente: {formatMoney(outstanding)}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="supplier-mode">Metodo de pago</Label>
            <select
              id="supplier-mode"
              value={modeOfPayment}
              onChange={(e) => setModeOfPayment(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {activeModes.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="supplier-ref">Referencia (opcional)</Label>
            <Input
              id="supplier-ref"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Numero de transferencia, cheque..."
            />
          </div>

          <Button type="submit" disabled={isPending || !selectedInvoice}>
            {isPending ? "Registrando..." : "Registrar pago"}
          </Button>

          {message ? (
            <div
              className={
                isError
                  ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
              }
            >
              {message}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
