"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";
import type { ErpnextPaymentEntry } from "@/types/erpnext";

type Props = {
  paymentEntryName: string;
  docstatus?: 0 | 1 | 2;
  detailHref: string;
  className?: string;
};

type CancelPaymentResponse = ApiResponse<{ payment_entry: ErpnextPaymentEntry }>;

function buildPdfHref(name: string, action: "view" | "download") {
  const params = new URLSearchParams({
    doctype: "Payment Entry",
    name,
    action,
  });

  return `/api/erpnext/documents/pdf?${params.toString()}`;
}

export function PaymentEntryActionsMenu({
  paymentEntryName,
  docstatus,
  detailHref,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const canCancel = docstatus === 1;

  async function handleCancel() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(
        `/api/erpnext/payment-entries/${encodeURIComponent(paymentEntryName)}/cancel`,
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
        setConfirming(false);
        return;
      }

      setMessage("Pago anulado.");
      setConfirming(false);
      setOpen(false);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo anular el pago.");
      setConfirming(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className={cn("relative inline-block text-left", className)}>
      <Button
        type="button"
        size="xs"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setMessage(null);
          setIsError(false);
        }}
      >
        Acciones
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border bg-card p-1 text-sm shadow-lg">
          <Link
            href={detailHref}
            className="block rounded-md px-3 py-2 hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            Ver detalle
          </Link>
          <Link
            href={buildPdfHref(paymentEntryName, "view")}
            target="_blank"
            rel="noreferrer"
            className="block rounded-md px-3 py-2 hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            Ver PDF
          </Link>
          <Link
            href={buildPdfHref(paymentEntryName, "download")}
            className="block rounded-md px-3 py-2 hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            Descargar PDF
          </Link>
          {canCancel ? (
            <div className="border-t pt-1">
              {!confirming ? (
                <button
                  type="button"
                  className="block w-full rounded-md px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
                  onClick={() => setConfirming(true)}
                >
                  Anular
                </button>
              ) : (
                <div className="space-y-1 px-2 py-2">
                  <p className="text-xs text-muted-foreground">
                    Confirmar anulacion
                  </p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      onClick={handleCancel}
                      disabled={isPending}
                    >
                      {isPending ? "..." : "Si"}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setConfirming(false)}
                      disabled={isPending}
                    >
                      No
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <p
          className={cn(
            "mt-1 max-w-44 text-xs",
            isError ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
