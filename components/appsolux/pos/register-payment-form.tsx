"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextModeOfPayment } from "@/types/erpnext";

type RegisterPaymentFormProps = {
  salesInvoiceName: string;
  outstandingAmount: number;
  modesOfPayment: ErpnextModeOfPayment[];
};

type RegisterPaymentResponse = ApiResponse<{
  payment_entry: {
    name: string;
    paid_amount?: number;
    mode_of_payment?: string;
    party?: string;
    docstatus?: 0 | 1 | 2;
    status?: string;
  };
}>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function RegisterPaymentForm({
  salesInvoiceName,
  outstandingAmount,
  modesOfPayment,
}: RegisterPaymentFormProps) {
  const router = useRouter();
  const enabledModesOfPayment = modesOfPayment.filter(
    (modeOfPayment) =>
      modeOfPayment.enabled !== false && modeOfPayment.enabled !== 0
  );
  const [paidAmount, setPaidAmount] = useState(
    outstandingAmount > 0 ? String(outstandingAmount) : "0"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [paymentName, setPaymentName] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const numericPaidAmount = Number(paidAmount);
  const canSubmit =
    outstandingAmount > 0 &&
    Number.isFinite(numericPaidAmount) &&
    numericPaidAmount > 0 &&
    enabledModesOfPayment.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setPaymentName(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/erpnext/payment-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sales_invoice_name: salesInvoiceName,
          paid_amount: Number(formData.get("paid_amount") ?? 0),
          mode_of_payment: String(formData.get("mode_of_payment") ?? ""),
          reference_no: String(formData.get("reference_no") ?? "").trim(),
          reference_date: String(formData.get("reference_date") ?? "").trim(),
          note: String(formData.get("note") ?? "").trim(),
        }),
      });
      const result = (await response.json()) as RegisterPaymentResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Pago registrado correctamente.");
      setPaymentName(result.data.payment_entry.name);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo registrar el pago"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Registrar pago</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra un cobro basico contra esta factura. La facturacion
          electronica y recibos se conectaran en una fase posterior.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <span className="text-muted-foreground">Monto pendiente: </span>
        <span className="font-semibold">{formatMoney(outstandingAmount)}</span>
      </div>

      {enabledModesOfPayment.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Primero configura metodos de pago en el ERP.
        </div>
      ) : null}

      {outstandingAmount <= 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Esta factura no tiene saldo pendiente.
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paid_amount">Monto a cobrar</Label>
            <Input
              id="paid_amount"
              name="paid_amount"
              type="number"
              min="0.01"
              step="0.01"
              value={paidAmount}
              onChange={(event) => setPaidAmount(event.target.value)}
              disabled={outstandingAmount <= 0}
              required
            />
            {numericPaidAmount > outstandingAmount ? (
              <p className="text-xs text-amber-700">
                El monto supera el saldo pendiente.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mode_of_payment">Metodo de pago</Label>
            <select
              id="mode_of_payment"
              name="mode_of_payment"
              className={selectClassName}
              disabled={enabledModesOfPayment.length === 0}
              required
            >
              <option value="">Selecciona un metodo</option>
              {enabledModesOfPayment.map((modeOfPayment) => (
                <option key={modeOfPayment.name} value={modeOfPayment.name}>
                  {modeOfPayment.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reference_no">Referencia opcional</Label>
            <Input
              id="reference_no"
              name="reference_no"
              placeholder="Ej. transferencia, voucher"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference_date">Fecha referencia opcional</Label>
            <Input id="reference_date" name="reference_date" type="date" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Nota opcional</Label>
          <Input id="note" name="note" placeholder="Ej. abono recibido" />
        </div>

        {message ? (
          <div
            className={
              isError
                ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
            }
          >
            <p>{message}</p>
            {paymentName ? (
              <p className="mt-1 font-medium">Pago: {paymentName}</p>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Registrando..." : "Registrar pago"}
        </Button>
      </form>
    </div>
  );
}
