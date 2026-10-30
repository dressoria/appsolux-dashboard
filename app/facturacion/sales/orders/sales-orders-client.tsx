"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";

type OrderRow = {
  id: string;
  number: number;
  issueDate: string;
  customerName: string;
  total: string;
  status: string;
  sellerName: string | null;
  convertedSaleId: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CONVERTED: "Facturada",
  CANCELLED: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-blue-50 text-blue-700",
  CONVERTED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export function SalesOrdersClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    params.set("perPage", String(perPage));

    try {
      const res = await fetch(`/api/facturacion/sales-orders?${params}`);
      const data = await res.json();
      if (data.ok) {
        setOrders(data.orders);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, from, to, page, perPage]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleAction(orderId: string, action: string) {
    const res = await fetch(`/api/facturacion/sales-orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (action === "convert" && data.draftId) {
      router.push(`${routes.facturacionSalesNew}?draftId=${data.draftId}`);
      return;
    }
    fetchOrders();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-slate-50 p-4">
        <div className="flex flex-1 items-center gap-2 min-w-[200px]">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))}
            className="h-9"
          />
          <Button variant="outline" size="sm" onClick={() => { setSearch(searchInput); setPage(1); }}>Buscar</Button>
        </div>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="CONVERTED">Facturada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-36" />
        <span className="text-sm text-slate-400">—</span>
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-36" />
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Cargando...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No se encontraron órdenes.</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-sm font-medium">OV-{String(order.number).padStart(6, "0")}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {new Date(order.issueDate).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 font-medium">{order.customerName}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">${Number(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? ""}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{order.sellerName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/api/facturacion/sales-orders/${order.id}/pdf`, "_blank")}>
                        <FileText className="mr-1 h-3.5 w-3.5" /> PDF
                      </Button>
                      {order.status === "DRAFT" && (
                        <Button variant="outline" size="sm" onClick={() => handleAction(order.id, "confirm")}>Confirmar</Button>
                      )}
                      {(order.status === "DRAFT" || order.status === "CONFIRMED") && (
                        <Button size="sm" className="bg-[#1E52F1] text-white" onClick={() => handleAction(order.id, "convert")}>Facturar</Button>
                      )}
                      {order.status !== "CONVERTED" && order.status !== "CANCELLED" && (
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleAction(order.id, "cancel")}>Cancelar</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{total} orden{total !== 1 ? "es" : ""} · Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
