"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import type { ApiResponse } from "@/types/api";

type CreateInvoiceFromOrderButtonProps = {
  salesOrderName: string;
};

type CreateInvoiceResponse = ApiResponse<{
  sales_invoice: {
    name: string;
    customer: string;
    grand_total?: number;
    status?: string;
    docstatus?: 0 | 1 | 2;
  };
}>;

export function CreateInvoiceFromOrderButton({
  salesOrderName,
}: CreateInvoiceFromOrderButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [invoiceName, setInvoiceName] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateInvoice() {
    setIsSubmitting(true);
    setMessage(null);
    setInvoiceName(null);
    setIsError(false);

    try {
      const response = await fetch(
        "/api/erpnext/sales-invoices/from-sales-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sales_order_name: salesOrderName }),
        }
      );
      const result = (await response.json()) as CreateInvoiceResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Factura preparada correctamente.");
      setInvoiceName(result.data.sales_invoice.name);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la factura"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Preparar factura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta accion prepara una factura en borrador. La emision, pago y
          comprobantes se conectaran en la siguiente fase.
        </p>
      </div>
      <Button type="button" onClick={handleCreateInvoice} disabled={isSubmitting}>
        {isSubmitting ? "Preparando..." : "Preparar factura"}
      </Button>
      {message ? (
        <div
          className={
            isError
              ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
          }
        >
          <p>{message}</p>
          {invoiceName ? (
            <div className="mt-2 space-y-2">
              <p className="font-medium">Factura: {invoiceName}</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`${routes.posInvoices}/${encodeURIComponent(invoiceName)}`}>
                  Ver facturas y cobros
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
