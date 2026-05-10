"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { ErpnextPaymentEntry } from "@/types/erpnext";

type Props = {
  paymentEntryName: string;
  docstatus?: 0 | 1 | 2;
};

type CancelPaymentResponse = ApiResponse<{ payment_entry: ErpnextPaymentEntry }>;

export function CancelPaymentButton({ paymentEntryName, docstatus }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (docstatus !== 1) return null;

  async function handleCancel() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const res = await fetch(
        `/api/erpnext/payment-entries/${encodeURIComponent(paymentEntryName)}/cancel`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      const result = (await res.json()) as CancelPaymentResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        setConfirming(false);
        return;
      }

      setMessage("Anulado.");
      setConfirming(false);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo anular.");
      setConfirming(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {!confirming ? (
        <Button
          size="sm"
          variant="outline"
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => setConfirming(true)}
        >
          Anular
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? "..." : "Confirmar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(false)}
            disabled={isPending}
          >
            No
          </Button>
        </div>
      )}
      {message ? (
        <p className={`text-xs ${isError ? "text-rose-600" : "text-muted-foreground"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
