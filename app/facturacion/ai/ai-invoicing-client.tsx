"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, Search, RefreshCw, Trash2, Save, FileText,
  Receipt, Plus, X, Eraser, Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CustomerResult = {
  id: string;
  name: string;
  tradeName: string | null;
  identification: string | null;
  email: string | null;
};

type ProposalLineItem = {
  productId: string;
  productName: string;
  primaryCode: string | null;
  quantity: number;
  unitPrice: string;
  catalogUnitPrice: string;
  priceAdjusted: boolean;
  discountAmount: string;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
};

type Proposal = {
  id: string;
  proposalNumber: number;
  subtotal: string;
  taxTotal: string;
  total: string;
  items: ProposalLineItem[];
  isExact: boolean;
  combinationHash: string | null;
};

type Draft = {
  id: string;
  status: string;
  requestedAmount: string;
  taxMode: string;
  paymentMethod: string | null;
  sriPaymentCode: string | null;
  batchId: string | null;
  batchPosition: number | null;
  customer: { id: string; name: string; identification: string | null } | null;
  activeProposal: Proposal | null;
  selectedProposalId: string | null;
  savedAt: string | null;
  createdAt: string;
};

type InvoiceRow = {
  amount: string;
  taxMode: string;
};

const TAX_MODE_OPTIONS = [
  { value: "AUTO", label: "Automático" },
  { value: "IVA_0", label: "Solo IVA 0%" },
  { value: "IVA_15", label: "Solo IVA 15%" },
  { value: "MIXED", label: "Mixto" },
] as const;

const SRI_PAYMENTS = [
  { code: "01", label: "Sin sistema financiero" },
  { code: "16", label: "Tarjeta de débito" },
  { code: "17", label: "Dinero electrónico" },
  { code: "18", label: "Tarjeta prepago" },
  { code: "19", label: "Tarjeta de crédito" },
  { code: "20", label: "Otros con sistema financiero" },
  { code: "21", label: "Endoso de títulos" },
];

const PAYMENT_METHODS = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "credit", label: "Crédito" },
];

function formatMoney(value: string) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function AiInvoicingClient() {
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [rows, setRows] = useState<InvoiceRow[]>([{ amount: "", taxMode: "AUTO" }]);
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [sriPaymentCode, setSriPaymentCode] = useState("20");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Draft[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<Draft[]>([]);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [batchInvoicing, setBatchInvoicing] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-invoicing/drafts");
      const data = await res.json();
      if (data.ok) {
        const proposed = (data.drafts as Draft[]).filter((d) => d.status === "PROPOSED" || d.status === "CREATED");
        const saved = (data.drafts as Draft[]).filter((d) => d.status === "SAVED");
        setPendingDrafts(proposed);
        setSavedDrafts(saved);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) { setCustomerResults([]); return; }
    try {
      const res = await fetch(`/api/ai-invoicing/customers?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.ok) { setCustomerResults(data.customers); setShowCustomerDropdown(true); }
    } catch { setCustomerResults([]); }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!customerQuery.trim()) { setCustomerResults([]); setShowCustomerDropdown(false); return; }
    searchTimeout.current = setTimeout(() => searchCustomers(customerQuery), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [customerQuery, searchCustomers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowCustomerDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addRow() { setRows([...rows, { amount: "", taxMode: "AUTO" }]); }
  function removeRow(i: number) { if (rows.length > 1) setRows(rows.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: string, value: string) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function handleClear() {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setRows([{ amount: "", taxMode: "AUTO" }]);
    setPaymentMethod("transfer");
    setSriPaymentCode("20");
    setError(null);
  }

  async function handleGenerate() {
    setError(null);
    const validRows = rows.filter((r) => {
      const n = parseFloat(r.amount);
      return n > 0;
    });
    if (validRows.length === 0) { setError("Ingresa al menos un monto válido."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/ai-invoicing/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id ?? null,
          paymentMethod,
          sriPaymentCode,
          requests: validRows.map((r) => ({
            requestedAmount: r.amount,
            taxMode: r.taxMode,
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Error al generar."); return; }
      await loadDrafts();
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function handleRegenerate(draftId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/ai-invoicing/drafts/${draftId}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Error al regenerar."); return; }
      await loadDrafts();
    } catch { setError("Error de conexión."); }
  }

  async function handleSave(draftId: string) {
    try {
      await fetch(`/api/ai-invoicing/drafts/${draftId}/save`, { method: "POST" });
      await loadDrafts();
    } catch { /* ignore */ }
  }

  async function handleDiscard(draftId: string) {
    try {
      await fetch(`/api/ai-invoicing/drafts/${draftId}/discard`, { method: "POST" });
      await loadDrafts();
    } catch { /* ignore */ }
  }

  async function handleInvoice(proposalId: string) {
    setInvoicingId(proposalId);
    setError(null);
    try {
      const res = await fetch(`/api/ai-invoicing/proposals/${proposalId}/invoice`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Error al facturar."); return; }
      await loadDrafts();
    } catch { setError("Error de conexión."); }
    finally { setInvoicingId(null); }
  }

  async function handleBatchInvoice() {
    const exactDrafts = pendingDrafts.filter((d) => d.activeProposal);
    if (exactDrafts.length === 0) return;
    setBatchInvoicing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-invoicing/batch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalIds: exactDrafts.map((d) => d.activeProposal!.id),
        }),
      });
      const data = await res.json();
      if (data.failed > 0) {
        setError(`${data.succeeded} facturadas, ${data.failed} con error.`);
      }
      await loadDrafts();
    } catch { setError("Error de conexión."); }
    finally { setBatchInvoicing(false); }
  }

  function isLegacyMismatch(draft: Draft): boolean {
    if (!draft.activeProposal) return false;
    return draft.activeProposal.total !== draft.requestedAmount;
  }

  const exactPendingCount = pendingDrafts.filter((d) => d.activeProposal && !isLegacyMismatch(d)).length;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="size-6 text-[#1769E0]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#172033]">
            Facturación inteligente
          </h1>
        </div>
        <p className="mt-1 text-sm text-[#667085]">
          Genera facturas por el monto exacto y emítelas en pocos segundos.
        </p>
      </header>

      {/* FORM */}
      <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none">
        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Customer */}
            <div className="relative" ref={dropdownRef}>
              <Label className="text-sm font-medium text-[#172033]">Cliente</Label>
              {selectedCustomer ? (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#1769E0]/30 bg-[#F7FAFF] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#172033]">{selectedCustomer.name}</p>
                    {selectedCustomer.identification && <p className="truncate text-xs text-[#667085]">{selectedCustomer.identification}</p>}
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setCustomerQuery(""); }} className="text-xs text-[#667085] hover:text-[#172033]">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Buscar cliente..." className="pl-9" />
                </div>
              )}
              {showCustomerDropdown && customerResults.length > 0 && !selectedCustomer && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#E4E9F0] bg-white shadow-lg">
                  {customerResults.map((c) => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerQuery(""); setShowCustomerDropdown(false); }}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#F7FAFF]">
                      <span className="text-sm font-medium text-[#172033]">{c.name}</span>
                      <span className="text-xs text-[#667085]">{[c.identification, c.tradeName].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-[#172033]">Forma de pago</Label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033]">
                  {PAYMENT_METHODS.map((pm) => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172033]">Forma SRI</Label>
                <select value={sriPaymentCode} onChange={(e) => setSriPaymentCode(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033]">
                  {SRI_PAYMENTS.map((sp) => <option key={sp.code} value={sp.code}>{sp.code} · {sp.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Invoice rows */}
          <div>
            <Label className="text-sm font-medium text-[#172033]">Facturas a generar</Label>
            <div className="mt-2 space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-8 text-right text-xs font-medium text-[#667085]">#{i + 1}</span>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]">$</span>
                    <Input type="number" step="0.01" min="0.01" value={row.amount}
                      onChange={(e) => updateRow(i, "amount", e.target.value)} placeholder="0.00" className="pl-7" />
                  </div>
                  <select value={row.taxMode} onChange={(e) => updateRow(i, "taxMode", e.target.value)}
                    className="w-36 rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033]">
                    {TAX_MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-[#667085] hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={addRow}>
              <Plus className="size-4" /> Otra factura
            </Button>
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={loading} className="bg-[#1769E0] text-white hover:bg-[#155DC4]">
              <Sparkles className="size-4" /> {loading ? "Generando..." : "Generar facturas"}
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <Eraser className="size-4" /> Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PENDING PROPOSALS */}
      {pendingDrafts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#172033]">Por facturar</h2>
            {exactPendingCount >= 2 && (
              <Button size="sm" onClick={handleBatchInvoice} disabled={batchInvoicing}
                className="bg-[#1769E0] text-white hover:bg-[#155DC4]">
                <Receipt className="size-4" />
                {batchInvoicing ? "Facturando..." : `Facturar todas (${exactPendingCount})`}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingDrafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} isLegacy={isLegacyMismatch(draft)}
                onRegenerate={handleRegenerate} onSave={handleSave} onDiscard={handleDiscard}
                onInvoice={handleInvoice} invoicingId={invoicingId} />
            ))}
          </div>
        </section>
      )}

      {/* SAVED */}
      {savedDrafts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#172033]">Guardadas para luego</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {savedDrafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} isLegacy={isLegacyMismatch(draft)}
                onRegenerate={handleRegenerate} onSave={handleSave} onDiscard={handleDiscard}
                onInvoice={handleInvoice} invoicingId={invoicingId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DraftCard({ draft, isLegacy, onRegenerate, onSave, onDiscard, onInvoice, invoicingId }: {
  draft: Draft;
  isLegacy: boolean;
  onRegenerate: (id: string) => void;
  onSave: (id: string) => void;
  onDiscard: (id: string) => void;
  onInvoice: (proposalId: string) => void;
  invoicingId: string | null;
}) {
  const proposal = draft.activeProposal;
  const items = proposal?.items as ProposalLineItem[] | undefined;
  const isInvoicing = invoicingId === proposal?.id;

  return (
    <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-[#172033]">
              {draft.customer?.name ?? "Sin cliente"}
            </span>
            <span className="ml-2 text-xs text-[#667085]">
              {formatMoney(draft.requestedAmount)}
            </span>
          </div>
          {proposal && !isLegacy && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <Check className="size-3" /> Cuadre exacto
            </span>
          )}
          {isLegacy && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Motor anterior
            </span>
          )}
        </div>

        {isLegacy && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Esta propuesta fue creada con el motor anterior y necesita regenerarse.
          </div>
        )}

        {items && !isLegacy && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E9F0] text-[#667085]">
                    <th className="pb-2 pr-2 font-medium">Producto</th>
                    <th className="pb-2 pr-2 text-right font-medium">Cant.</th>
                    <th className="pb-2 pr-2 text-right font-medium">P. unit.</th>
                    <th className="pb-2 pr-2 text-right font-medium">IVA</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[#E4E9F0]/50 text-[#172033]">
                      <td className="max-w-[140px] truncate py-1.5 pr-2">
                        {item.productName}
                        {item.priceAdjusted && (
                          <span className="ml-1 text-[10px] text-amber-600" title="Precio ajustado para cuadre">*</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right">{item.quantity}</td>
                      <td className="py-1.5 pr-2 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="py-1.5 pr-2 text-right">{item.taxRate}%</td>
                      <td className="py-1.5 text-right">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1 border-t border-[#E4E9F0] pt-3 text-sm">
              <div className="flex justify-between text-[#667085]">
                <span>Subtotal</span><span>{formatMoney(proposal!.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#667085]">
                <span>IVA</span><span>{formatMoney(proposal!.taxTotal)}</span>
              </div>
              <div className="flex justify-between font-semibold text-[#172033]">
                <span>Total</span><span>{formatMoney(proposal!.total)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#667085]">
                <span>Monto solicitado</span><span>{formatMoney(draft.requestedAmount)}</span>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {proposal && !isLegacy && (
            <>
              <Button size="sm" onClick={() => onInvoice(proposal.id)} disabled={isInvoicing}
                className="bg-[#1769E0] text-white hover:bg-[#155DC4]">
                <Receipt className="size-4" />
                {isInvoicing ? "Facturando..." : "Facturar ahora"}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`/facturacion/sales/new?aiProposalId=${proposal.id}&aiDraftId=${draft.id}`}>
                  <FileText className="size-4" /> Editar
                </a>
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => onRegenerate(draft.id)}>
            <RefreshCw className="size-4" /> {isLegacy ? "Regenerar exacta" : "Otra combinación"}
          </Button>
          {draft.status !== "SAVED" && (
            <Button size="sm" variant="outline" onClick={() => onSave(draft.id)}>
              <Save className="size-4" /> Guardar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onDiscard(draft.id)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700">
            <Trash2 className="size-4" /> Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
