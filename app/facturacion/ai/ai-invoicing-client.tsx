"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, Search, RefreshCw, Trash2, Save, FileText,
  Receipt, Plus, X, Eraser, Check, AlertTriangle,
  Package, DollarSign, Loader2, ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// --------------- Types ---------------

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
  originalPrompt?: string | null;
};

type ConvertedDraft = {
  id: string;
  requestedAmount: string | null;
  customer: { id: string; name: string; identification: string | null } | null;
  convertedSaleId: string | null;
  convertedAt: string | null;
  sriDocumentId: string | null;
  sriDocumentStatus: string | null;
};

type InvoiceRow = {
  amount: string;
  taxMode: string;
};

type SriOption = { id: string; code: string; name: string };
type IssuePointOption = SriOption & { establishmentId: string; establishment?: { code: string; name: string } };

type ProductResult = {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  primaryCode: string | null;
  auxiliaryCode: string | null;
  description: string | null;
  taxRate: number;
};

type ResolvedLine = {
  lineNumber: number;
  quantity: number;
  searchTerm: string;
  status: "searching" | "found" | "multiple" | "not_found";
  candidates: ProductResult[];
  selectedProduct: ProductResult | null;
};

type InvoiceResult = {
  saleId: string;
  sriStatus: "success" | "failed";
  sriFlowLabel?: string;
  sriError?: string;
  sriDocumentId?: string;
};

// --------------- Constants ---------------

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

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function isByProducts(draft: Draft): boolean {
  return draft.originalPrompt?.startsWith("BY_PRODUCTS:") ?? false;
}

const LS_KEY_PRODUCTS_TEXT = "facturom_products_text";
function loadSavedText(): string {
  try { return localStorage.getItem(LS_KEY_PRODUCTS_TEXT) ?? ""; } catch { return ""; }
}
function saveDraftText(text: string) {
  try { localStorage.setItem(LS_KEY_PRODUCTS_TEXT, text); } catch { /* */ }
}

// --------------- Main Component ---------------

export function AiInvoicingClient({ hasSriConfig }: { hasSriConfig: boolean }) {
  const [activeTab, setActiveTab] = useState<"by_amount" | "by_products">("by_amount");

  // Shared state
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [sriPaymentCode, setSriPaymentCode] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Draft[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<Draft[]>([]);
  const [recentConverted, setRecentConverted] = useState<ConvertedDraft[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // SRI config
  const [establishments, setEstablishments] = useState<SriOption[]>([]);
  const [issuePoints, setIssuePoints] = useState<IssuePointOption[]>([]);
  const [establishmentId, setEstablishmentId] = useState<string>("");
  const [issuePointId, setIssuePointId] = useState<string>("");

  // By-amount state
  const [rows, setRows] = useState<InvoiceRow[]>([{ amount: "", taxMode: "AUTO" }]);
  const [loading, setLoading] = useState(false);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [batchInvoicing, setBatchInvoicing] = useState(false);
  const [invoiceResults, setInvoiceResults] = useState<Map<string, InvoiceResult>>(new Map());

  // By-products state
  const [productsText, setProductsText] = useState("");
  const [resolvedLines, setResolvedLines] = useState<ResolvedLine[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productProposal, setProductProposal] = useState<{
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxRate: number;
      subtotal: number;
      taxAmount: number;
      total: number;
    }>;
    subtotal: number;
    taxTotal: number;
    total: number;
  } | null>(null);
  const [productActionLoading, setProductActionLoading] = useState<string | null>(null);
  const [productActionResult, setProductActionResult] = useState<{
    type: "proforma" | "sri" | "receipt";
    success: boolean;
    message: string;
    sriStatus?: "success" | "failed";
    sriError?: string;
    saleId?: string;
  } | null>(null);

  // Load drafts
  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-invoicing/drafts");
      const data = await res.json();
      if (data.ok) {
        const proposed = (data.drafts as Draft[]).filter((d) => d.status === "PROPOSED" || d.status === "CREATED");
        const saved = (data.drafts as Draft[]).filter((d) => d.status === "SAVED");
        setPendingDrafts(proposed);
        setSavedDrafts(saved);
        if (data.recentConverted) setRecentConverted(data.recentConverted);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  // Load SRI config
  useEffect(() => {
    if (!hasSriConfig) return;
    Promise.all([
      fetch("/api/sri/establishments").then((r) => r.json()),
      fetch("/api/sri/issue-points").then((r) => r.json()),
    ]).then(([estData, ipData]) => {
      const ests = estData.establishments ?? [];
      const ips = ipData.issuePoints ?? [];
      setEstablishments(ests);
      setIssuePoints(ips);
      if (ests.length === 1) setEstablishmentId(ests[0].id);
      if (ips.length === 1) setIssuePointId(ips[0].id);
    }).catch(() => { /* SRI config load failed — non-blocking */ });
  }, [hasSriConfig]);

  // Load saved products text
  useEffect(() => { setProductsText(loadSavedText()); }, []);

  // Customer search
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

  // By-amount handlers
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
    setInvoiceResults(new Map());
  }

  async function handleGenerate() {
    setError(null);
    const validRows = rows.filter((r) => parseFloat(r.amount) > 0);
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
      const res = await fetch(`/api/ai-invoicing/proposals/${proposalId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId: establishmentId || undefined,
          issuePointId: issuePointId || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Error al facturar."); return; }

      const result: InvoiceResult = {
        saleId: data.saleId,
        sriStatus: data.sriStatus ?? "success",
        sriError: data.sriError ?? undefined,
        sriDocumentId: data.sri?.documentId,
        sriFlowLabel: data.sri?.flowLabel,
      };
      setInvoiceResults((prev) => new Map(prev).set(proposalId, result));
      await loadDrafts();
    } catch { setError("Error de conexión."); }
    finally { setInvoicingId(null); }
  }

  async function handleBatchInvoice() {
    const exactDrafts = pendingDrafts.filter((d) => d.activeProposal && !isByProducts(d));
    if (exactDrafts.length === 0) return;
    setBatchInvoicing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-invoicing/batch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalIds: exactDrafts.map((d) => d.activeProposal!.id),
          establishmentId: establishmentId || undefined,
          issuePointId: issuePointId || undefined,
        }),
      });
      const data = await res.json();
      if (data.results) {
        const sriOk = data.results.filter((r: Record<string, unknown>) => r.ok && r.sriStatus === "success").length;
        const sriFail = data.results.filter((r: Record<string, unknown>) => r.ok && r.sriStatus === "failed").length;
        const saleFail = data.results.filter((r: Record<string, unknown>) => !r.ok).length;
        const parts: string[] = [];
        if (sriOk > 0) parts.push(`${sriOk} facturada(s) con SRI`);
        if (sriFail > 0) parts.push(`${sriFail} venta(s) creada(s) sin emisión SRI`);
        if (saleFail > 0) parts.push(`${saleFail} con error`);
        if (parts.length > 0) setError(parts.join(", ") + ".");
      }
      await loadDrafts();
    } catch { setError("Error de conexión."); }
    finally { setBatchInvoicing(false); }
  }

  async function handleSriRetry(saleId: string) {
    setError(null);
    try {
      const res = await fetch("/api/sri/documents/from-basic-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error al reintentar emisión SRI.");
        return;
      }
      await loadDrafts();
    } catch { setError("Error de conexión."); }
  }

  // By-products handlers
  async function handleSearchProducts() {
    const text = productsText.trim();
    if (!text) return;

    const lines = text.split("\n").map((l, i) => ({ raw: l.trim(), lineNumber: i + 1 })).filter((l) => l.raw.length > 0);
    const parsed: ResolvedLine[] = lines.map(({ raw, lineNumber }) => {
      const match = raw.match(/^(\d+)\s*[xX]?\s+(.+)$/);
      const quantity = match ? Math.max(parseInt(match[1], 10), 1) : 1;
      const searchTerm = match ? match[2].trim() : raw;
      return { lineNumber, quantity, searchTerm, status: "searching" as const, candidates: [], selectedProduct: null };
    });

    setResolvedLines(parsed);
    setSearchingProducts(true);
    setProductProposal(null);
    setProductActionResult(null);

    const updated = [...parsed];
    await Promise.all(
      updated.map(async (line, i) => {
        try {
          const res = await fetch(`/api/facturacion/pos/products?q=${encodeURIComponent(line.searchTerm)}`);
          const data = await res.json();
          const products: ProductResult[] = data.products ?? [];
          if (products.length === 1) {
            updated[i] = { ...line, status: "found", candidates: products, selectedProduct: products[0] };
          } else if (products.length > 1) {
            updated[i] = { ...line, status: "multiple", candidates: products, selectedProduct: null };
          } else {
            updated[i] = { ...line, status: "not_found", candidates: [], selectedProduct: null };
          }
        } catch {
          updated[i] = { ...line, status: "not_found", candidates: [], selectedProduct: null };
        }
      }),
    );

    setResolvedLines([...updated]);
    setSearchingProducts(false);
  }

  function selectProductForLine(lineIndex: number, product: ProductResult) {
    setResolvedLines((prev) => prev.map((l, i) =>
      i === lineIndex ? { ...l, status: "found", selectedProduct: product } : l,
    ));
  }

  function generateProductProposal() {
    const allResolved = resolvedLines.every((l) => l.selectedProduct);
    if (!allResolved) return;

    const items = resolvedLines.map((l) => {
      const p = l.selectedProduct!;
      const subtotal = l.quantity * p.price;
      const taxAmount = subtotal * (p.taxRate / 100);
      const total = subtotal + taxAmount;
      return {
        productId: p.id,
        productName: p.name,
        quantity: l.quantity,
        unitPrice: p.price,
        discountAmount: 0,
        taxRate: p.taxRate,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    });

    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const taxTotal = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = items.reduce((s, i) => s + i.total, 0);

    setProductProposal({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
    });
  }

  function updateProposalItemQty(index: number, qty: number) {
    if (!productProposal || qty < 1) return;
    const items = productProposal.items.map((item, i) => {
      if (i !== index) return item;
      const subtotal = qty * item.unitPrice;
      const taxAmount = subtotal * (item.taxRate / 100);
      const total = subtotal + taxAmount;
      return {
        ...item,
        quantity: qty,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const taxTotal = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = items.reduce((s, i) => s + i.total, 0);
    setProductProposal({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
    });
  }

  function removeProposalItem(index: number) {
    if (!productProposal || productProposal.items.length <= 1) return;
    const items = productProposal.items.filter((_, i) => i !== index);
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const taxTotal = items.reduce((s, i) => s + i.taxAmount, 0);
    const total = items.reduce((s, i) => s + i.total, 0);
    setProductProposal({
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
    });
  }

  async function handleProductAction(action: "proforma" | "sri" | "receipt") {
    if (!productProposal) return;
    setProductActionLoading(action);
    setProductActionResult(null);
    setError(null);

    const apiItems = productProposal.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      taxRate: item.taxRate,
    }));

    try {
      if (action === "proforma") {
        const res = await fetch("/api/basic/proformas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: selectedCustomer?.id ?? undefined,
            establishmentId: establishmentId || undefined,
            issueDate: new Date().toISOString().split("T")[0],
            items: apiItems.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discountAmount,
              taxRate: it.taxRate,
            })),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setProductActionResult({ type: "proforma", success: true, message: "Proforma creada exitosamente." });
        } else {
          setProductActionResult({ type: "proforma", success: false, message: data.error ?? "Error al crear proforma." });
        }
      } else {
        const outputMode = action === "sri" ? "sri_invoice" : "internal_receipt";
        const res = await fetch("/api/basic/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethod,
            outputMode,
            customerId: selectedCustomer?.id ?? undefined,
            paidAmount: productProposal.total,
            sriPaymentCode,
            establishmentId: establishmentId || undefined,
            issuePointId: issuePointId || undefined,
            items: apiItems.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discountAmount: it.discountAmount,
            })),
          }),
        });
        const data = await res.json();
        if (data.ok) {
          const output = data.output ?? {};
          if (action === "sri") {
            setProductActionResult({
              type: "sri",
              success: true,
              message: output.status === "sri_flow_started"
                ? "Venta creada. Emisión SRI en proceso."
                : "Venta creada.",
              sriStatus: output.errorMessage ? "failed" : "success",
              sriError: output.errorMessage ?? undefined,
              saleId: data.sale?.id,
            });
          } else {
            setProductActionResult({
              type: "receipt",
              success: true,
              message: "Recibo interno creado exitosamente.",
              saleId: data.sale?.id,
            });
          }
        } else {
          setProductActionResult({
            type: action,
            success: false,
            message: data.error ?? "Error al crear venta.",
          });
        }
      }

      // Save draft for history
      await fetch("/api/ai-invoicing/product-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: productsText,
          customerId: selectedCustomer?.id ?? null,
          paymentMethod,
          sriPaymentCode,
          items: apiItems,
        }),
      }).catch(() => { /* non-blocking */ });

    } catch {
      setProductActionResult({ type: action, success: false, message: "Error de conexión." });
    } finally {
      setProductActionLoading(null);
    }
  }

  function handleProductsTextChange(text: string) {
    setProductsText(text);
    saveDraftText(text);
  }

  function clearProductsForm() {
    setProductsText("");
    setResolvedLines([]);
    setProductProposal(null);
    setProductActionResult(null);
    saveDraftText("");
  }

  function isLegacyMismatch(draft: Draft): boolean {
    if (!draft.activeProposal) return false;
    return draft.activeProposal.total !== draft.requestedAmount;
  }

  const byAmountPending = pendingDrafts.filter((d) => !isByProducts(d));
  const byProductsPending = pendingDrafts.filter((d) => isByProducts(d));
  const exactPendingCount = byAmountPending.filter((d) => d.activeProposal && !isLegacyMismatch(d)).length;

  const filteredIssuePoints = establishmentId
    ? issuePoints.filter((ip) => ip.establishmentId === establishmentId)
    : issuePoints;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="size-6 text-[#1E52F1]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[#172033]">
            Facturación inteligente
          </h1>
        </div>
        <p className="mt-1 text-sm text-[#667085]">
          Genera facturas por monto o por productos, y emítelas en segundos.
        </p>
      </header>

      {/* TAB BAR */}
      <div className="flex gap-1 rounded-lg border border-[#E4E9F0] bg-[#F9FAFB] p-1">
        <button
          onClick={() => setActiveTab("by_amount")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "by_amount"
              ? "bg-white text-[#1E52F1] shadow-sm"
              : "text-[#667085] hover:text-[#172033]"
          }`}
        >
          <DollarSign className="size-4" />
          Por monto
        </button>
        <button
          onClick={() => setActiveTab("by_products")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "by_products"
              ? "bg-white text-[#1E52F1] shadow-sm"
              : "text-[#667085] hover:text-[#172033]"
          }`}
        >
          <Package className="size-4" />
          Por productos
        </button>
      </div>

      {/* SHARED FORM: Customer + Payment + SRI */}
      <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none">
        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Customer */}
            <div className="relative" ref={dropdownRef}>
              <Label className="text-sm font-medium text-[#172033]">Cliente</Label>
              {selectedCustomer ? (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#1E52F1]/30 bg-[#F7FAFF] px-3 py-2">
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

          {/* SRI Establishment / Issue Point */}
          {hasSriConfig && establishments.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-[#172033]">Establecimiento</Label>
                <select value={establishmentId} onChange={(e) => { setEstablishmentId(e.target.value); setIssuePointId(""); }}
                  className="mt-1.5 w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033]">
                  <option value="">Automático</option>
                  {establishments.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#172033]">Punto de emisión</Label>
                <select value={issuePointId} onChange={(e) => setIssuePointId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033]">
                  <option value="">Automático</option>
                  {filteredIssuePoints.map((ip) => (
                    <option key={ip.id} value={ip.id}>
                      {ip.establishment?.code ?? ""}-{ip.code} · {ip.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TAB-SPECIFIC CONTENT */}
          {activeTab === "by_amount" ? (
            <>
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

              <div className="flex gap-2">
                <Button onClick={handleGenerate} disabled={loading} className="bg-[#1E52F1] text-white hover:bg-[#1845D1]">
                  <Sparkles className="size-4" /> {loading ? "Generando..." : "Generar facturas"}
                </Button>
                <Button variant="outline" onClick={handleClear}>
                  <Eraser className="size-4" /> Limpiar
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* BY PRODUCTS FORM */}
              <div>
                <Label className="text-sm font-medium text-[#172033]">Productos (uno por línea)</Label>
                <p className="mb-2 text-xs text-[#667085]">
                  Formato: cantidad + nombre. Ej: <code className="rounded bg-[#F1F5F9] px-1">20 dr melaxin exfoliante</code>
                </p>
                <textarea
                  value={productsText}
                  onChange={(e) => handleProductsTextChange(e.target.value)}
                  placeholder={"20 dr melaxin exfoliante\n10 drenaje\n3 chupagrass"}
                  rows={5}
                  className="w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#172033] placeholder:text-[#9CA3AF] focus:border-[#1E52F1] focus:outline-none focus:ring-1 focus:ring-[#1E52F1]"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSearchProducts} disabled={searchingProducts || !productsText.trim()}
                  className="bg-[#1E52F1] text-white hover:bg-[#1845D1]">
                  {searchingProducts ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  {searchingProducts ? "Buscando..." : "Buscar productos"}
                </Button>
                <Button variant="outline" onClick={clearProductsForm}>
                  <Eraser className="size-4" /> Limpiar
                </Button>
              </div>
            </>
          )}

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </CardContent>
      </Card>

      {/* PRODUCT RESOLUTION TABLE */}
      {activeTab === "by_products" && resolvedLines.length > 0 && (
        <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-[#172033]">Resolución de productos</h3>
            <div className="space-y-2">
              {resolvedLines.map((line, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-[#E4E9F0] p-3">
                  <span className="mt-0.5 w-6 text-right text-xs font-medium text-[#667085]">{line.quantity}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#172033]">{line.searchTerm}</p>
                    {line.status === "searching" && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#667085]">
                        <Loader2 className="size-3 animate-spin" /> Buscando...
                      </p>
                    )}
                    {line.status === "found" && line.selectedProduct && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                        <Check className="size-3" /> {line.selectedProduct.name} — {formatMoney(line.selectedProduct.price)}
                        {line.selectedProduct.stock !== undefined && (
                          <span className="text-[#667085]"> · Stock: {line.selectedProduct.stock}</span>
                        )}
                      </p>
                    )}
                    {line.status === "multiple" && (
                      <div className="mt-1">
                        <p className="mb-1 text-xs text-amber-600">
                          <AlertTriangle className="mr-1 inline size-3" /> {line.candidates.length} resultados — selecciona uno:
                        </p>
                        <select
                          value={line.selectedProduct?.id ?? ""}
                          onChange={(e) => {
                            const prod = line.candidates.find((c) => c.id === e.target.value);
                            if (prod) selectProductForLine(i, prod);
                          }}
                          className="w-full rounded border border-[#E4E9F0] bg-white px-2 py-1 text-xs text-[#172033]"
                        >
                          <option value="">Seleccionar...</option>
                          {line.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — {formatMoney(c.price)} {c.stock !== undefined ? `(stock: ${c.stock})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {line.status === "not_found" && (
                      <p className="mt-1 text-xs text-red-600">No encontrado</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!searchingProducts && resolvedLines.length > 0 && (
              <div className="mt-4">
                {resolvedLines.every((l) => l.selectedProduct) ? (
                  <Button onClick={generateProductProposal} className="bg-[#1E52F1] text-white hover:bg-[#1845D1]">
                    <Sparkles className="size-4" /> Generar propuesta
                  </Button>
                ) : (
                  <p className="text-xs text-[#667085]">Resuelve todos los productos para generar la propuesta.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PRODUCT PROPOSAL TABLE + 3 ACTIONS */}
      {activeTab === "by_products" && productProposal && (
        <Card className="rounded-xl border border-[#E4E9F0] bg-white shadow-none">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-[#172033]">Propuesta</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E9F0] text-[#667085]">
                    <th className="pb-2 pr-2 font-medium">Producto</th>
                    <th className="pb-2 pr-2 text-right font-medium">Cant.</th>
                    <th className="pb-2 pr-2 text-right font-medium">P. unit.</th>
                    <th className="pb-2 pr-2 text-right font-medium">IVA</th>
                    <th className="pb-2 pr-2 text-right font-medium">Total</th>
                    <th className="pb-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {productProposal.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[#E4E9F0]/50 text-[#172033]">
                      <td className="max-w-[140px] truncate py-1.5 pr-2">{item.productName}</td>
                      <td className="py-1.5 pr-2 text-right">
                        <input
                          type="number" min={1} value={item.quantity}
                          onChange={(e) => updateProposalItemQty(idx, parseInt(e.target.value) || 1)}
                          className="w-14 rounded border border-[#E4E9F0] px-1 py-0.5 text-right text-xs"
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="py-1.5 pr-2 text-right">{item.taxRate}%</td>
                      <td className="py-1.5 pr-2 text-right">{formatMoney(item.total)}</td>
                      <td className="py-1.5 text-right">
                        {productProposal.items.length > 1 && (
                          <button onClick={() => removeProposalItem(idx)} className="text-[#667085] hover:text-red-600">
                            <X className="size-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1 border-t border-[#E4E9F0] pt-3 text-sm">
              <div className="flex justify-between text-[#667085]">
                <span>Subtotal</span><span>{formatMoney(productProposal.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#667085]">
                <span>IVA</span><span>{formatMoney(productProposal.taxTotal)}</span>
              </div>
              <div className="flex justify-between font-semibold text-[#172033]">
                <span>Total</span><span>{formatMoney(productProposal.total)}</span>
              </div>
            </div>

            {/* Action result */}
            {productActionResult && (
              <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                productActionResult.success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}>
                <p>{productActionResult.message}</p>
                {productActionResult.sriStatus === "failed" && productActionResult.sriError && (
                  <p className="mt-1 text-xs">SRI: {productActionResult.sriError}</p>
                )}
                {productActionResult.sriStatus === "failed" && productActionResult.saleId && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => handleSriRetry(productActionResult.saleId!)}>
                    <RefreshCw className="size-3" /> Reintentar emisión SRI
                  </Button>
                )}
              </div>
            )}

            {/* Three action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline"
                onClick={() => handleProductAction("proforma")}
                disabled={productActionLoading !== null}
              >
                {productActionLoading === "proforma" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                Crear proforma
              </Button>
              <Button
                size="sm"
                onClick={() => handleProductAction("sri")}
                disabled={productActionLoading !== null || !hasSriConfig}
                className="bg-[#1E52F1] text-white hover:bg-[#1845D1]"
                title={!hasSriConfig ? "Configure SRI primero" : undefined}
              >
                {productActionLoading === "sri" ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
                Facturar SRI
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={() => handleProductAction("receipt")}
                disabled={productActionLoading !== null}
              >
                {productActionLoading === "receipt" ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
                Recibo interno
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PENDING PROPOSALS (by amount) */}
      {activeTab === "by_amount" && byAmountPending.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#172033]">Por facturar</h2>
            {exactPendingCount >= 2 && (
              <Button size="sm" onClick={handleBatchInvoice} disabled={batchInvoicing}
                className="bg-[#1E52F1] text-white hover:bg-[#1845D1]">
                <Receipt className="size-4" />
                {batchInvoicing ? "Facturando..." : `Facturar todas (${exactPendingCount})`}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {byAmountPending.map((draft) => (
              <DraftCard key={draft.id} draft={draft} isLegacy={isLegacyMismatch(draft)}
                onRegenerate={handleRegenerate} onSave={handleSave} onDiscard={handleDiscard}
                onInvoice={handleInvoice} invoicingId={invoicingId}
                invoiceResult={invoiceResults.get(draft.activeProposal?.id ?? "")}
                onSriRetry={handleSriRetry} hasSriConfig={hasSriConfig} />
            ))}
          </div>
        </section>
      )}

      {/* PENDING PROPOSALS (by products) */}
      {activeTab === "by_products" && byProductsPending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#172033]">Borradores por productos</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {byProductsPending.map((draft) => (
              <DraftCard key={draft.id} draft={draft} isLegacy={false}
                onRegenerate={handleRegenerate} onSave={handleSave} onDiscard={handleDiscard}
                onInvoice={handleInvoice} invoicingId={invoicingId}
                invoiceResult={invoiceResults.get(draft.activeProposal?.id ?? "")}
                onSriRetry={handleSriRetry} hasSriConfig={hasSriConfig} />
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
                onInvoice={handleInvoice} invoicingId={invoicingId}
                invoiceResult={undefined} onSriRetry={handleSriRetry} hasSriConfig={hasSriConfig} />
            ))}
          </div>
        </section>
      )}

      {/* RECENT CONVERTED with SRI status */}
      {recentConverted.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#172033]">Recientes</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {recentConverted.map((d) => (
              <Card key={d.id} className="rounded-xl border border-[#E4E9F0] bg-white shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-[#172033]">{d.customer?.name ?? "Sin cliente"}</span>
                      {d.requestedAmount && <span className="ml-2 text-xs text-[#667085]">{formatMoney(d.requestedAmount)}</span>}
                    </div>
                    <SriStatusBadge status={d.sriDocumentStatus} />
                  </div>
                  {d.convertedAt && (
                    <p className="mt-1 text-xs text-[#667085]">
                      {new Date(d.convertedAt).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                  {d.sriDocumentStatus && !["AUTHORIZED", "SENT", "RECEIVED"].includes(d.sriDocumentStatus) && d.convertedSaleId && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => handleSriRetry(d.convertedSaleId!)}>
                      <RefreshCw className="size-3" /> Reintentar SRI
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --------------- SRI Status Badge ---------------

function SriStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Preparando", color: "bg-blue-50 text-blue-700" },
    READY_FOR_TESTING: { label: "Preparando", color: "bg-blue-50 text-blue-700" },
    SIGNED: { label: "Firmado", color: "bg-blue-50 text-blue-700" },
    SENT: { label: "Enviado", color: "bg-amber-50 text-amber-700" },
    RECEIVED: { label: "Recibido", color: "bg-amber-50 text-amber-700" },
    AUTHORIZED: { label: "Autorizado", color: "bg-emerald-50 text-emerald-700" },
    REJECTED: { label: "Rechazado", color: "bg-red-50 text-red-700" },
    ERROR: { label: "Error", color: "bg-red-50 text-red-700" },
  };
  const info = map[status] ?? { label: status, color: "bg-gray-50 text-gray-700" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}

// --------------- DraftCard ---------------

function DraftCard({ draft, isLegacy, onRegenerate, onSave, onDiscard, onInvoice, invoicingId, invoiceResult, onSriRetry, hasSriConfig }: {
  draft: Draft;
  isLegacy: boolean;
  onRegenerate: (id: string) => void;
  onSave: (id: string) => void;
  onDiscard: (id: string) => void;
  onInvoice: (proposalId: string) => void;
  invoicingId: string | null;
  invoiceResult?: InvoiceResult;
  onSriRetry: (saleId: string) => void;
  hasSriConfig: boolean;
}) {
  const proposal = draft.activeProposal;
  const items = proposal?.items as ProposalLineItem[] | undefined;
  const isInvoicing = invoicingId === proposal?.id;
  const byProducts = isByProducts(draft);

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
            {byProducts && (
              <span className="ml-2 rounded-full bg-[#F0F4FF] px-2 py-0.5 text-[10px] font-medium text-[#1E52F1]">
                Por productos
              </span>
            )}
          </div>
          {proposal && !isLegacy && !byProducts && (
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

        {/* Invoice result with SRI status */}
        {invoiceResult && (
          <div className={`mb-3 rounded-lg border p-2 text-xs ${
            invoiceResult.sriStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {invoiceResult.sriStatus === "success" ? (
              <p><Check className="mr-1 inline size-3" /> Venta creada y emisión SRI iniciada.
                {invoiceResult.sriFlowLabel && ` Estado: ${invoiceResult.sriFlowLabel}`}</p>
            ) : (
              <>
                <p><AlertTriangle className="mr-1 inline size-3" /> Venta creada pero falló la emisión SRI.</p>
                {invoiceResult.sriError && <p className="mt-1">Error: {invoiceResult.sriError}</p>}
                <Button size="sm" variant="outline" className="mt-1" onClick={() => onSriRetry(invoiceResult.saleId)}>
                  <RefreshCw className="size-3" /> Reintentar SRI
                </Button>
              </>
            )}
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
              {!byProducts && (
                <div className="flex justify-between text-xs text-[#667085]">
                  <span>Monto solicitado</span><span>{formatMoney(draft.requestedAmount)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {proposal && !isLegacy && (
            <>
              <Button size="sm" onClick={() => onInvoice(proposal.id)} disabled={isInvoicing}
                className="bg-[#1E52F1] text-white hover:bg-[#1845D1]">
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
          {!byProducts && (
            <Button size="sm" variant="outline" onClick={() => onRegenerate(draft.id)}>
              <RefreshCw className="size-4" /> {isLegacy ? "Regenerar exacta" : "Otra combinación"}
            </Button>
          )}
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
