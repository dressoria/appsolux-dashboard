"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Search, Trash2 } from "lucide-react";

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

type Line = {
  productName: string;
  code: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxCategory: string | null;
  description: string;
};

const money = (v: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v);
const dateInput = (d: Date) => d.toISOString().slice(0, 10);

export function CreditNoteEditor() {
  const router = useRouter();
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [type, setType] = useState("RETURN");
  const [reason, setReason] = useState("Devolución de mercadería");
  const [issueDate, setIssueDate] = useState(dateInput(new Date()));
  const [lines, setLines] = useState<Line[]>([]);
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
    setLines([{
      productName: "Devolución total",
      code: null,
      quantity: 1,
      unitPrice: Number(inv.grandTotal),
      discount: 0,
      taxRate: 0,
      taxCategory: null,
      description: "",
    }]);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productName: "", code: null, quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, taxCategory: null, description: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const computedLines = lines.map((l) => {
    const base = l.quantity * l.unitPrice;
    const subtotal = base - l.discount;
    const tax = subtotal * (l.taxRate / 100);
    return { ...l, subtotal, tax, total: subtotal + tax };
  });

  const subtotal = computedLines.reduce((s, l) => s + l.subtotal, 0);
  const tax = computedLines.reduce((s, l) => s + l.tax, 0);
  const total = subtotal + tax;

  async function save() {
    if (savingRef.current) return;
    if (!selectedInvoice) { setMessage("Seleccione una factura autorizada."); return; }
    if (lines.length === 0) { setMessage("Agregue al menos un ítem."); return; }
    if (!reason.trim()) { setMessage("Ingrese el motivo."); return; }

    const invoiceTotal = Number(selectedInvoice.grandTotal);
    if (total > invoiceTotal) {
      setMessage(`El total (${money(total)}) no puede superar el total de la factura (${money(invoiceTotal)}).`);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/facturacion/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSriDocumentId: selectedInvoice.id,
          type,
          reason,
          customerName: selectedInvoice.customerName,
          customerIdentification: selectedInvoice.customerIdentification,
          issueDate,
          subtotal,
          tax,
          total,
          items: computedLines.map((l) => ({
            productName: l.productName,
            code: l.code,
            description: l.description || null,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
            taxCategory: l.taxCategory,
            subtotal: l.subtotal,
            tax: l.tax,
            total: l.total,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(routes.facturacionCreditNotes);
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
          <Link href={routes.facturacionCreditNotes}><ArrowLeft className="mr-1 h-4 w-4" />Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Nueva nota de crédito</h1>
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
                <button className="mt-1 text-xs text-red-500" onClick={() => { setSelectedInvoice(null); setLines([]); }}>Cambiar factura</button>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Detalle de la nota de crédito</h2>
              <Button variant="outline" size="sm" onClick={addLine}>+ Línea</Button>
            </div>
            {lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase text-slate-500 border-b">
                      <th className="py-2 pr-2">Descripción</th>
                      <th className="py-2 px-2 w-20">Cant.</th>
                      <th className="py-2 px-2 w-24">Precio</th>
                      <th className="py-2 px-2 w-20">IVA %</th>
                      <th className="py-2 px-2 text-right w-24">Total</th>
                      <th className="py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedLines.map((l, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <Input value={l.productName} onChange={(e) => updateLine(i, { productName: e.target.value })} className="h-8" placeholder="Concepto" />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min={1} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value)) })} className="h-8 w-20" />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min={0} step={0.01} value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} className="h-8 w-24" />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min={0} step={1} value={l.taxRate} onChange={(e) => updateLine(i, { taxRate: Number(e.target.value) })} className="h-8 w-20" />
                        </td>
                        <td className="py-2 px-2 text-right font-medium tabular-nums">{money(l.total)}</td>
                        <td className="py-2 text-center">
                          <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-sm">Detalles</h2>
            <label className="block text-xs font-medium text-slate-500">Tipo</label>
            <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="RETURN">Devolución</option>
              <option value="DISCOUNT">Descuento posterior</option>
              <option value="BONUS">Bonificación</option>
              <option value="ADJUSTMENT">Ajuste de precio</option>
            </select>
            <label className="block text-xs font-medium text-slate-500">Motivo</label>
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Devolución de mercadería" />
            <label className="block text-xs font-medium text-slate-500">Fecha emisión</label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-9" />
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium tabular-nums">{money(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">IVA</span><span className="font-medium tabular-nums">{money(tax)}</span></div>
            <hr />
            <div className="flex justify-between text-base font-bold"><span>Total NC</span><span className="tabular-nums">{money(total)}</span></div>
            {selectedInvoice && total > Number(selectedInvoice.grandTotal) && (
              <p className="text-xs text-red-600">El total supera el monto de la factura original.</p>
            )}
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
