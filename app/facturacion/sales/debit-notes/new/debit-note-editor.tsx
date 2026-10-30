"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";

type Invoice = {
  id: string;
  displayNumber: string;
  issuedAt: string | null;
  customerName: string;
  customerIdentification: string | null;
  grandTotal: string;
};

type Reason = {
  description: string;
  amount: number;
  taxRate: number;
};

const money = (v: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v);
const dateInput = (d: Date) => d.toISOString().slice(0, 10);

export function DebitNoteEditor() {
  const router = useRouter();
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [issueDate, setIssueDate] = useState(dateInput(new Date()));
  const [reasons, setReasons] = useState<Reason[]>([{ description: "Intereses por mora", amount: 0, taxRate: 0 }]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function searchInvoices(q: string) {
    setInvoiceSearch(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setInvoiceResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/facturacion/credit-notes/search-invoices?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.ok) setInvoiceResults(data.invoices);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectInvoice(inv: Invoice) {
    setSelectedInvoice(inv);
    setInvoiceSearch("");
    setInvoiceResults([]);
  }

  function updateReason(index: number, patch: Partial<Reason>) {
    setReasons((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addReason() {
    setReasons((prev) => [...prev, { description: "", amount: 0, taxRate: 0 }]);
  }

  function removeReason(index: number) {
    setReasons((prev) => prev.filter((_, i) => i !== index));
  }

  const computedReasons = reasons.map((r) => {
    const tax = r.amount * (r.taxRate / 100);
    return { ...r, tax, total: r.amount + tax };
  });

  const subtotal = computedReasons.reduce((s, r) => s + r.amount, 0);
  const tax = computedReasons.reduce((s, r) => s + r.tax, 0);
  const total = subtotal + tax;

  async function save() {
    if (savingRef.current) return;
    if (!selectedInvoice) { setMessage("Seleccione una factura autorizada."); return; }
    if (reasons.length === 0) { setMessage("Agregue al menos un motivo."); return; }
    if (reasons.some((r) => r.amount <= 0)) { setMessage("Todos los montos deben ser positivos."); return; }
    if (reasons.some((r) => !r.description.trim())) { setMessage("Todos los motivos requieren descripción."); return; }

    savingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/facturacion/debit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSriDocumentId: selectedInvoice.id,
          customerName: selectedInvoice.customerName,
          customerIdentification: selectedInvoice.customerIdentification,
          issueDate,
          subtotal,
          tax,
          total,
          reasons: computedReasons.map((r) => ({
            description: r.description,
            amount: r.amount,
            taxRate: r.taxRate,
            tax: r.tax,
            total: r.total,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(routes.facturacionDebitNotes);
      } else {
        setMessage(data.error ?? "Error al guardar.");
      }
    } catch {
      setMessage("Error de conexión.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={routes.facturacionDebitNotes}><ArrowLeft className="mr-1 h-4 w-4" />Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Nueva nota de débito</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Invoice search */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-sm">Factura de origen (solo AUTORIZADAS)</h2>
            <div className="relative">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por número, cliente o identificación..."
                  value={invoiceSearch}
                  onChange={(e) => searchInvoices(e.target.value)}
                  className="h-9"
                />
              </div>
              {(invoiceResults.length > 0 || searching) && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-white shadow-lg text-sm">
                  {searching && <p className="px-3 py-2 text-slate-400">Buscando...</p>}
                  {invoiceResults.map((inv) => (
                    <button key={inv.id} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 border-b last:border-0" onClick={() => selectInvoice(inv)}>
                      <div>
                        <span className="font-mono font-medium">{inv.displayNumber}</span>
                        <span className="ml-2 text-slate-600">{inv.customerName}</span>
                      </div>
                      <span className="font-medium">${Number(inv.grandTotal).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedInvoice && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm">
                <p className="font-medium">{selectedInvoice.displayNumber} — {selectedInvoice.customerName}</p>
                <p className="text-slate-600">ID: {selectedInvoice.customerIdentification ?? "—"} · Total: ${Number(selectedInvoice.grandTotal).toFixed(2)}</p>
                <button className="mt-1 text-xs text-red-500" onClick={() => setSelectedInvoice(null)}>Cambiar factura</button>
              </div>
            )}
          </div>

          {/* Reasons */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Motivos del cargo</h2>
              <Button variant="outline" size="sm" onClick={addReason}><Plus className="mr-1 h-3.5 w-3.5" /> Motivo</Button>
            </div>
            {reasons.length > 0 && (
              <div className="space-y-3">
                {computedReasons.map((r, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Input
                        value={r.description}
                        onChange={(e) => updateReason(i, { description: e.target.value })}
                        className="h-8 flex-1"
                        placeholder="Descripción del motivo (ej: Intereses por mora)"
                      />
                      <button onClick={() => removeReason(i)} className="mt-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="flex gap-3">
                      <div>
                        <label className="text-xs text-slate-500">Valor</label>
                        <Input type="number" min={0} step={0.01} value={r.amount} onChange={(e) => updateReason(i, { amount: Number(e.target.value) })} className="h-8 w-28" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">IVA %</label>
                        <Input type="number" min={0} step={1} value={r.taxRate} onChange={(e) => updateReason(i, { taxRate: Number(e.target.value) })} className="h-8 w-20" />
                      </div>
                      <div className="flex flex-col justify-end">
                        <span className="text-sm font-medium tabular-nums">{money(r.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-sm">Detalles</h2>
            <label className="block text-xs font-medium text-slate-500">Fecha emisión</label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-9" />
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium tabular-nums">{money(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">IVA</span><span className="font-medium tabular-nums">{money(tax)}</span></div>
            <hr />
            <div className="flex justify-between text-base font-bold"><span>Total ND</span><span className="tabular-nums">{money(total)}</span></div>
          </div>

          {message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

          <Button className="w-full rounded-xl bg-[#1E52F1] text-white hover:bg-[#1E52F1]/90" disabled={saving} onClick={save}>
            <Save className="mr-2 h-4 w-4" /> Guardar borrador
          </Button>
        </div>
      </div>
    </div>
  );
}
