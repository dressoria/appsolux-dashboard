"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Download, FileCheck2, FileText } from "lucide-react";

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

type SriDocInfo = {
  id: string;
  status: string;
  environment: string;
  sriAuthorizationNumber: string | null;
};

function money(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function paidAmount(sale: Sale) {
  return sale.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    pending: "bg-slate-50 text-slate-600 border-slate-200",
    canceled: "bg-red-50 text-red-600 border-red-200",
  };
  const label: Record<string, string> = {
    paid: "Pagado",
    partial: "Parcial",
    pending: "Pendiente",
    canceled: "Cancelado",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {label[status] ?? status}
    </span>
  );
}

function SriTypeBadge({ sri }: { sri: SriDocInfo }) {
  if (sri.status === "AUTHORIZED") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        Factura SRI autorizada
      </span>
    );
  }
  if (sri.status === "REJECTED") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
        Factura SRI rechazada
      </span>
    );
  }
  if (sri.status === "SENT" || sri.status === "SIGNED") {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
        Factura SRI en proceso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      Factura SRI borrador
    </span>
  );
}

export function SalesList({
  sales,
  sriDocuments = {},
}: {
  sales: Sale[];
  sriDocuments?: Record<string, SriDocInfo>;
}) {
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
        const sri = sriDocuments[sale.id];

        return (
          <div
            key={sale.id}
            className="space-y-3 rounded-[18px] border border-slate-200 bg-white p-4 text-sm shadow-sm"
          >
            {/* Row 1: summary */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{money(sale.total)}</span>
                  <PaymentStatusBadge status={sale.status === "canceled" ? "canceled" : sale.paymentStatus} />
                  {sri ? (
                    <SriTypeBadge sri={sri} />
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Recibo interno
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(sale.createdAt).toLocaleString("es-EC", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {sale.customer?.name ?? "Consumidor final"}
                </p>
                <p className="text-xs text-slate-400 truncate max-w-sm">
                  {sale.items.map((item) => `${item.product.name} ×${item.quantity}`).join(", ")}
                </p>
              </div>

              {/* Acciones principales */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/basic/sales/${sale.id}`}>Ver venta</Link>
                </Button>
                {sri && (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={`/sri/documents/${sri.id}`}>Factura SRI</Link>
                  </Button>
                )}
                {canPay && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentSaleId(paymentSaleId === sale.id ? "" : sale.id)}
                  >
                    Abonar
                  </Button>
                )}
                {sale.status !== "canceled" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => cancelSale(sale.id)}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            {/* Row 2: descargas directas SRI */}
            {sri && (sri.status === "SIGNED" || sri.status === "SENT" || sri.status === "AUTHORIZED") && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mr-1">
                  Descargas
                </span>
                {(sri.status === "SIGNED" || sri.status === "SENT" || sri.status === "AUTHORIZED") && (
                  <a
                    href={`/api/sri/documents/${sri.id}/download-signed-xml`}
                    download
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3 w-3" />
                    XML firmado
                  </a>
                )}
                {sri.status === "AUTHORIZED" && (
                  <>
                    <a
                      href={`/api/sri/documents/${sri.id}/download-authorized-xml`}
                      download
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <FileCheck2 className="h-3 w-3" />
                      XML autorizado
                    </a>
                    <a
                      href={`/api/sri/documents/${sri.id}/download-ride`}
                      download
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <FileText className="h-3 w-3" />
                      RIDE / PDF
                    </a>
                  </>
                )}
              </div>
            )}

            {/* Row 3: form de abono */}
            {paymentSaleId === sale.id ? (
              <form
                onSubmit={(event) => addPayment(event, sale.id)}
                className="grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-[160px_160px_auto]"
              >
                <div className="space-y-1">
                  <Label>Metodo</Label>
                  <select
                    name="method"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Monto</Label>
                  <Input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={pending}
                    required
                  />
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
