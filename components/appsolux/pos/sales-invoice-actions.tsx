"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { SalesInvoiceActionResult } from "@/types/erpnext";

type SalesInvoiceActionsProps = {
  salesInvoiceName: string;
  docstatus?: 0 | 1 | 2;
  status?: string;
  outstandingAmount?: number;
};

type ActionResponse = ApiResponse<SalesInvoiceActionResult>;
type DeleteResponse = ApiResponse<{ action: "deleted"; name: string }>;
type CorrectResponse = ApiResponse<{
  corrected_invoice: {
    name: string;
    customer: string;
    grand_total?: number;
    docstatus?: 0 | 1 | 2;
    status?: string;
  };
  original_invoice: string;
}>;

function getFriendlyActionError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("payment") || lowerMessage.includes("pago")) {
    return "No se pudo anular la factura. Puede requerir anular el pago primero.";
  }

  return message;
}

export function SalesInvoiceActions({
  salesInvoiceName,
  docstatus,
  status,
  outstandingAmount,
}: SalesInvoiceActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function runAction(
    url: string,
    successMessage: string,
    body?: Record<string, unknown>
  ) {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const result = (await response.json()) as ActionResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(getFriendlyActionError(result.error.message));
        return;
      }

      setMessage(successMessage);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo procesar la accion"
      );
    } finally {
      setIsPending(false);
    }
  }

  async function deleteDraft() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(
        `/api/erpnext/sales-invoices/${encodeURIComponent(salesInvoiceName)}`,
        { method: "DELETE" }
      );
      const result = (await response.json()) as DeleteResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      router.push("/pos/invoices");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la factura"
      );
    } finally {
      setIsPending(false);
    }
  }

  async function createCorrection() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(
        `/api/erpnext/sales-invoices/${encodeURIComponent(
          salesInvoiceName
        )}/correct`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const result = (await response.json()) as CorrectResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(
        `Correccion creada correctamente: ${result.data.corrected_invoice.name}`
      );
      router.push(
        `/pos/invoices/${encodeURIComponent(
          result.data.corrected_invoice.name
        )}`
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear la correccion"
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Acciones de factura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Una factura en borrador se puede editar o eliminar. Una factura
          confirmada se puede anular si todavia no fue enviada al SRI.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cuando la facturacion electronica este activa, las facturas enviadas
          al SRI requeriran nota de credito o anulacion fiscal.
        </p>
      </div>

      {docstatus === 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(
                `/api/erpnext/sales-invoices/${encodeURIComponent(
                  salesInvoiceName
                )}/submit`,
                "Factura confirmada correctamente."
              )
            }
          >
            Confirmar factura
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="#editar-borrador">Editar borrador</Link>
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={deleteDraft}
          >
            Eliminar borrador
          </Button>
        </div>
      ) : null}

      {docstatus === 1 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                runAction(
                  `/api/erpnext/sales-invoices/${encodeURIComponent(
                    salesInvoiceName
                  )}/cancel`,
                  "Factura anulada correctamente.",
                  { reason: "Anulacion interna antes de SRI" }
                )
              }
            >
              Anular factura
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Para corregir una factura confirmada, primero debe anularse.
          </p>
        </div>
      ) : null}

      {docstatus === 2 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center rounded-full border bg-muted px-3 text-xs font-medium text-muted-foreground">
            Anulada
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={createCorrection}
          >
            Crear correccion
          </Button>
        </div>
      ) : null}

      {status ? (
        <p className="text-xs text-muted-foreground">
          Estado actual: {status}
          {typeof outstandingAmount === "number"
            ? `, pendiente: ${outstandingAmount.toFixed(2)}`
            : ""}
        </p>
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
