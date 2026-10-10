"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Search, Check, RefreshCw, ArrowRight } from "lucide-react";

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
  difference: string;
};

type Draft = {
  id: string;
  status: string;
  requestedAmount: string;
  taxMode: string;
};

const TAX_MODE_OPTIONS = [
  { value: "AUTO", label: "Automático" },
  { value: "IVA_0", label: "Solo IVA 0%" },
  { value: "IVA_15", label: "Solo IVA 15%" },
  { value: "MIXED", label: "Mixto" },
] as const;

function formatMoney(value: string) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function AiInvoicingClient() {
  const [prompt, setPrompt] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [amount, setAmount] = useState("");
  const [taxMode, setTaxMode] = useState<string>("AUTO");
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/ai-invoicing/customers?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.ok) {
        setCustomerResults(data.customers);
        setShowCustomerDropdown(true);
      }
    } catch {
      setCustomerResults([]);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!customerQuery.trim()) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(() => {
      searchCustomers(customerQuery);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [customerQuery, searchCustomers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleGenerate() {
    setError(null);
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Ingresa un monto válido mayor a 0.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai-invoicing/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id ?? null,
          requestedAmount: numAmount,
          taxMode,
          originalPrompt: prompt.trim() || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error al generar propuestas.");
        return;
      }
      setDraft(data.draft);
      setProposals(data.proposals);
      setSelectedProposalId(null);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!draft) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-invoicing/drafts/${draft.id}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error al regenerar.");
        return;
      }
      setProposals((prev) => [...prev, ...data.proposals]);
    } catch {
      setError("Error de conexión.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSelect(proposalId: string) {
    setSelecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-invoicing/proposals/${proposalId}/select`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error al seleccionar.");
        return;
      }
      setSelectedProposalId(proposalId);
      setDraft((prev) => (prev ? { ...prev, status: "SELECTED" } : null));
    } catch {
      setError("Error de conexión.");
    } finally {
      setSelecting(false);
    }
  }

  const latestProposals = proposals.slice(-3);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="size-6 text-[#1769E0]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#172033]">
            Facturación con IA
          </h1>
        </div>
        <p className="mt-1 text-sm text-[#667085]">
          Describe lo que necesitas y Facturom preparará opciones de factura para que las revises antes de emitir.
        </p>
      </header>

      <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none">
        <CardContent className="space-y-5 p-5">
          <div>
            <Label htmlFor="ai-prompt" className="text-sm font-medium text-[#172033]">
              ¿Qué quieres facturar?
            </Label>
            <textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Andres factura 20"
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033] placeholder:text-[#9CA3AF] focus:border-[#1769E0] focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative" ref={dropdownRef}>
              <Label htmlFor="customer-search" className="text-sm font-medium text-[#172033]">
                Cliente
              </Label>
              {selectedCustomer ? (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#1769E0]/30 bg-[#F7FAFF] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#172033]">
                      {selectedCustomer.name}
                    </p>
                    {selectedCustomer.identification && (
                      <p className="truncate text-xs text-[#667085]">
                        {selectedCustomer.identification}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerQuery("");
                    }}
                    className="text-xs text-[#667085] hover:text-[#172033]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input
                    id="customer-search"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="pl-9"
                  />
                </div>
              )}
              {showCustomerDropdown && customerResults.length > 0 && !selectedCustomer && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#E4E9F0] bg-white shadow-lg">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerQuery("");
                        setShowCustomerDropdown(false);
                      }}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#F7FAFF]"
                    >
                      <span className="text-sm font-medium text-[#172033]">{c.name}</span>
                      <span className="text-xs text-[#667085]">
                        {[c.identification, c.tradeName].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="amount" className="text-sm font-medium text-[#172033]">
                Monto
              </Label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tax-mode" className="text-sm font-medium text-[#172033]">
                IVA
              </Label>
              <select
                id="tax-mode"
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033] focus:border-[#1769E0] focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
              >
                {TAX_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-[#1769E0] text-white hover:bg-[#155DC4] sm:w-auto"
          >
            <Sparkles className="size-4" />
            {loading ? "Generando..." : "Generar propuestas"}
          </Button>
        </CardContent>
      </Card>

      {latestProposals.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#172033]">Propuestas</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RefreshCw className={`size-4 ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Generando..." : "Generar otras"}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {latestProposals.map((proposal) => {
              const isSelected = selectedProposalId === proposal.id;
              const diff = parseFloat(proposal.difference);
              const isExact = diff === 0;

              return (
                <Card
                  key={proposal.id}
                  className={`rounded-xl border shadow-none transition-colors ${
                    isSelected
                      ? "border-[#1769E0] bg-[#F7FAFF]"
                      : "border-[#E4E9F0] bg-white"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-[#172033]">
                        Propuesta {proposal.proposalNumber}
                      </h3>
                      {isSelected && (
                        <span className="flex items-center gap-1 rounded-full bg-[#1769E0] px-2 py-0.5 text-xs font-medium text-white">
                          <Check className="size-3" />
                          Seleccionada
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#E4E9F0] text-[#667085]">
                            <th className="pb-2 pr-2 font-medium">Producto</th>
                            <th className="pb-2 pr-2 font-medium">Código</th>
                            <th className="pb-2 pr-2 text-right font-medium">Cant.</th>
                            <th className="pb-2 pr-2 text-right font-medium">P. unit.</th>
                            <th className="pb-2 pr-2 text-right font-medium">IVA</th>
                            <th className="pb-2 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(proposal.items as ProposalLineItem[]).map((item, idx) => (
                            <tr key={idx} className="border-b border-[#E4E9F0]/50 text-[#172033]">
                              <td className="max-w-[120px] truncate py-1.5 pr-2">{item.productName}</td>
                              <td className="py-1.5 pr-2 text-[#667085]">{item.primaryCode ?? "—"}</td>
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
                        <span>Subtotal</span>
                        <span>{formatMoney(proposal.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-[#667085]">
                        <span>IVA</span>
                        <span>{formatMoney(proposal.taxTotal)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-[#172033]">
                        <span>Total</span>
                        <span>{formatMoney(proposal.total)}</span>
                      </div>
                      {draft && (
                        <div className="flex justify-between text-xs text-[#667085]">
                          <span>Monto solicitado</span>
                          <span>{formatMoney(draft.requestedAmount)}</span>
                        </div>
                      )}
                      <div className={`flex justify-between text-xs font-medium ${
                        isExact ? "text-emerald-600" : "text-amber-600"
                      }`}>
                        <span>{isExact ? "Cuadra exactamente" : "Diferencia"}</span>
                        {!isExact && <span>{formatMoney(proposal.difference)}</span>}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      {isSelected ? (
                        <Button
                          disabled
                          variant="outline"
                          size="sm"
                          className="w-full"
                          title="Integración con el editor de factura en la siguiente fase"
                        >
                          <ArrowRight className="size-4" />
                          Continuar a factura
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-[#1769E0] text-white hover:bg-[#155DC4]"
                          onClick={() => handleSelect(proposal.id)}
                          disabled={selecting || selectedProposalId !== null}
                        >
                          <Check className="size-4" />
                          {selecting ? "Seleccionando..." : "Seleccionar"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
