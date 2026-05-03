"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { ErpnextPaymentEntry } from "@/types/erpnext";

type PaymentEntryActionsProps = {
  paymentEntryName: string;
  docstatus?: 0 | 1 | 2;
};

type CancelPaymentResponse = ApiResponse<{
  payment_entry: ErpnextPaymentEntry;
}>;

export function PaymentEntryActions({
  paymentEntryName,
  docstatus,
}: PaymentEntryActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function cancelPayment() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(
        `/api/erpnext/payment-entries/${encodeURIComponent(
          paymentEntryName
        )}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const result = (await response.json()) as CancelPaymentResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Pago anulado correctamente.");
      window.location.reload();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo anular el pago"
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Acciones de pago</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Al anular un pago, la factura asociada volvera a quedar pendiente si
          corresponde.
        </p>
      </div>

      {docstatus === 1 ? (
        <Button
          type="button"
          variant="destructive"
          onClick={cancelPayment}
          disabled={isPending}
        >
          {isPending ? "Anulando..." : "Anular pago"}
        </Button>
      ) : null}

      {docstatus === 2 ? (
        <span className="inline-flex h-7 items-center rounded-full border bg-muted px-3 text-xs font-medium text-muted-foreground">
          Pago anulado
        </span>
      ) : null}

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
    </div>
  );
}
