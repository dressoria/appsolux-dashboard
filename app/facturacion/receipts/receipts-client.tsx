"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";

type ReceiptRow = {
  id: string;
  createdAt: string;
  customerName: string;
  customerIdentification: string | null;
  subtotal: string;
  taxTotal: string;
  total: string;
  status: string;
  paymentStatus: string;
  paymentMethods: string[];
  origin: string;
  itemCount: number;
};

type FiltersState = {
  q: string;
  from: string;
  to: string;
  status: string;
  paymentMethod: string;
  page: number;
};

const statusLabels: Record<string, string> = {
  open: "Abierta",
  paid: "Pagada",
  canceled: "Anulada",
};

const paymentLabels: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  credit: "Crédito",
};

function money(value: string) {
  return `$${Number(value).toFixed(2)}`;
}

export function ReceiptsClient() {
  const [sales, setSales] = useState<ReceiptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FiltersState>({
    q: "",
    from: "",
    to: "",
    status: "",
    paymentMethod: "",
    page: 1,
  });
  const [searchInput, setSearchInput] = useState("");

  const fetchReceipts = useCallback(async (f: FiltersState) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.q) params.set("q", f.q);
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
    if (f.status) params.set("status", f.status);
    if (f.paymentMethod) params.set("paymentMethod", f.paymentMethod);
    params.set("page", String(f.page));
    params.set("perPage", "20");

    try {
      const res = await fetch(`/api/receipts?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setSales(data.sales);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts(filters);
  }, [filters, fetchReceipts]);

  function handleSearch() {
    setFilters((prev) => ({ ...prev, q: searchInput, page: 1 }));
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Recibos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ventas internas que no tienen factura electrónica SRI asociada.
          </p>
        </div>
        <Button asChild className="rounded-xl bg-facturom-primary hover:bg-facturom-primary-soft">
          <Link href={routes.facturacionSalesNew}>+ Nueva venta</Link>
        </Button>
      </header>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4 pb-4">
          <div className="flex flex-1 items-center gap-2 min-w-[200px]">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, identificación o número..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-9"
            />
            <Button variant="outline" size="sm" onClick={handleSearch}>
              Buscar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, from: e.target.value, page: 1 }))
              }
              className="h-9 w-36"
            />
            <span className="text-sm text-slate-400">—</span>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, to: e.target.value, page: 1 }))
              }
              className="h-9 w-36"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))
            }
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="paid">Pagada</option>
            <option value="open">Abierta</option>
            <option value="canceled">Anulada</option>
          </select>
          <select
            value={filters.paymentMethod}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                paymentMethod: e.target.value,
                page: 1,
              }))
            }
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Todas las formas de pago</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
            <option value="credit">Crédito</option>
          </select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Identificación</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Impuestos</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Forma de pago</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      Cargando...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      No se encontraron recibos.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale, idx) => (
                    <tr
                      key={sale.id}
                      className="border-b last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {(filters.page - 1) * 20 + idx + 1}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {new Date(sale.createdAt).toLocaleDateString("es-EC", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {sale.customerName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {sale.customerIdentification ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {money(sale.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {money(sale.taxTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {money(sale.total)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sale.paymentMethods
                          .map((m) => paymentLabels[m] ?? m)
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            sale.status === "paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : sale.status === "canceled"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {statusLabels[sale.status] ?? sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`${routes.facturacionReceipts}/${sale.id}`}>
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              Ver
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              window.open(
                                `/api/basic/sales/${sale.id}/download-receipt`,
                                "_blank",
                              );
                            }}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-600">
              <span>
                {total} recibo{total !== 1 ? "s" : ""} · Página {filters.page}{" "}
                de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= totalPages}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
