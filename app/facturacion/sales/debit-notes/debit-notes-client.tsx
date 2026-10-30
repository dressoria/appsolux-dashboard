"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NoteRow = {
  id: string;
  number: number;
  issueDate: string;
  customerName: string;
  total: string;
  status: string;
  sourceInvoiceNumber: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_SRI: "Pendiente SRI",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_SRI: "bg-amber-50 text-amber-700",
  AUTHORIZED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export function DebitNotesClient() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("perPage", String(perPage));

    try {
      const res = await fetch(`/api/facturacion/debit-notes?${params}`);
      const data = await res.json();
      if (data.ok) {
        setNotes(data.notes);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, page, perPage]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  async function handleCancel(noteId: string) {
    await fetch(`/api/facturacion/debit-notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    fetchNotes();
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
          <option value="PENDING_SRI">Pendiente SRI</option>
          <option value="AUTHORIZED">Autorizada</option>
          <option value="REJECTED">Rechazada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Factura origen</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Cargando...</td></tr>
            ) : notes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No se encontraron notas de débito.</td></tr>
            ) : (
              notes.map((n) => (
                <tr key={n.id} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-sm font-medium">ND-{String(n.number).padStart(6, "0")}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {new Date(n.issueDate).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 font-medium">{n.customerName}</td>
                  <td className="px-4 py-3 text-slate-600">{n.sourceInvoiceNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">${Number(n.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[n.status] ?? ""}`}>
                      {STATUS_LABELS[n.status] ?? n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {n.status === "DRAFT" && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleCancel(n.id)}>Cancelar</Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{total} nota{total !== 1 ? "s" : ""} · Página {page} de {totalPages}</span>
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
