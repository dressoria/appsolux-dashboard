"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Download, FileCheck2, FileText, Search, X } from "lucide-react";

import { SriDownloadButton } from "@/components/appsolux/sri/sri-download-button";
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

type TypeFilter = "all" | "receipt" | "sri" | "authorized" | "in_process" | "failed";

const TYPE_FILTER_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "receipt", label: "Recibos" },
  { key: "sri", label: "Facturas SRI" },
  { key: "authorized", label: "Autorizadas" },
  { key: "in_process", label: "En proceso" },
  { key: "failed", label: "Fallidas" },
];

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
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
    >
      {label[status] ?? status}
    </span>
  );
}

function SriTypeBadge({ sri }: { sri: SriDocInfo }) {
  if (sri.status === "AUTHORIZED") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        Factura SRI · Autorizada
      </span>
    );
  }
  if (sri.status === "REJECTED") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
        Factura SRI · Rechazada
      </span>
    );
  }
  if (sri.status === "SENT" || sri.status === "SIGNED") {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
        Factura SRI · En proceso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      Factura SRI · Borrador
    </span>
  );
}

function matchesTypeFilter(_sale: Sale, sri: SriDocInfo | undefined, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "receipt") return !sri;
  if (filter === "sri") return !!sri;
  if (filter === "authorized") return sri?.status === "AUTHORIZED";
  if (filter === "in_process") return sri?.status === "SIGNED" || sri?.status === "SENT";
  if (filter === "failed") return sri?.status === "REJECTED";
  return true;
}

function matchesSearch(sale: Sale, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (sale.customer?.name.toLowerCase().includes(q)) return true;
  if (sale.items.some((item) => item.product.name.toLowerCase().includes(q))) return true;
  if (sale.id.toLowerCase().includes(q)) return true;
  return false;
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return sales.filter((sale) => {
      const sri = sriDocuments[sale.id];
      return matchesTypeFilter(sale, sri, typeFilter) && matchesSearch(sale, search);
    });
  }, [sales, sriDocuments, typeFilter, search]);

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
      setError(
        requestError instanceof Error ? requestError.message : "No se pudo registrar abono."
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Buscar por cliente, producto o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === key
                  ? "border-[#004080] bg-[#004080] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Sales list */}
      <div className="space-y-2.5">
        {filtered.map((sale) => {
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
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{money(sale.total)}</span>
                    <PaymentStatusBadge
                      status={sale.status === "canceled" ? "canceled" : sale.paymentStatus}
                    />
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
                  <p className="max-w-sm truncate text-xs text-slate-400">
                    {sale.items.map((item) => `${item.product.name} ×${item.quantity}`).join(", ")}
                  </p>
                </div>

                {/* Acciones principales */}
                <div className="flex shrink-0 flex-wrap gap-2">
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
                      onClick={() =>
                        setPaymentSaleId(paymentSaleId === sale.id ? "" : sale.id)
                      }
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
              {sri &&
                (sri.status === "SIGNED" ||
                  sri.status === "SENT" ||
                  sri.status === "AUTHORIZED") && (
                  <div className="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
                    <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Descargas
                    </span>
                    <SriDownloadButton
                      href={`/api/sri/documents/${sri.id}/download-signed-xml`}
                      label="XML firmado"
                      icon={Download}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {sri.status === "AUTHORIZED" && (
                      <>
                        <SriDownloadButton
                          href={`/api/sri/documents/${sri.id}/download-authorized-xml`}
                          label="XML autorizado"
                          icon={FileCheck2}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <SriDownloadButton
                          href={`/api/sri/documents/${sri.id}/download-ride`}
                          label="RIDE / PDF"
                          icon={FileText}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        />
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

        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search || typeFilter !== "all"
              ? "No hay ventas que coincidan con los filtros aplicados."
              : "No hay ventas para mostrar."}
          </p>
        )}
      </div>
    </div>
  );
}
