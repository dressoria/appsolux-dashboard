"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileDown,
  Plus,
  ReceiptText,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditableNumberInput } from "./editable-number-input";
import {
  PaymentModal,
  MultiplePaymentModal,
  COMMERCIAL_LABELS,
  COMMERCIAL_TO_SRI,
  type PaymentEntry,
  type TreasuryAccountOption,
} from "./payment-modal";

type Customer = {
  id: string;
  name: string;
  tradeName: string | null;
  identification: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};
type Product = {
  id: string;
  name: string;
  primaryCode: string | null;
  auxiliaryCode: string | null;
  description: string | null;
  price: string;
  price2: string | null;
  price3: string | null;
  stock: number;
  taxRate: string;
  taxCategory: string | null;
  cost: string | null;
};
type Warehouse = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
};
type WarehouseStock = {
  warehouseId: string;
  productId: string;
  quantity: number;
};
type ShipmentGuide = {
  id: string;
  number: string;
  status: string;
  destinationAddress: string;
};
type Establishment = { id: string; code: string; name: string };
type IssuePoint = {
  id: string;
  code: string;
  name: string;
  establishmentId: string;
};
type Line = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  description: string;
};
type SavedResult = {
  saleId: string;
  documentId?: string;
  flowState?: "preparing" | "sending" | "received" | "authorized" | "rejected";
  flowLabel?: string;
};
type InvoiceKind = "NORMAL" | "EXPORT" | "REIMBURSEMENT";
type DraftPayload = {
  customerId: string;
  lines: Line[];
  paymentMethod: string;
  payments: PaymentEntry[];
  notes: string;
  priceTier: string;
  globalPct: number;
  globalAmount: number;
  warehouseId: string;
  invoiceKind: InvoiceKind;
  shipmentGuideId: string;
  establishmentId: string;
  issuePointId: string;
  exportData: ExportData;
  reimbursementData: ReimbursementData;
};
type ExportData = {
  incoterm: string;
  destinationPort: string;
  countryCode: string;
  countryName: string;
};
type ReimbursementData = {
  reimbursementDocType: string;
  reimbursementDocNumber: string;
  reimbursementTaxpayerId: string;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "check", label: "Cheque" },
  { value: "deposit", label: "Depósito" },
  { value: "transfer", label: "Transferencia" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Tarjeta de crédito" },
  { value: "credit", label: "Crédito" },
  { value: "multiple", label: "Múltiple" },
];

const money = (value: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    value,
  );
const priceFor = (product: Product, tier: string) =>
  Number(
    tier === "PVP2"
      ? (product.price2 ?? product.price)
      : tier === "PVP3"
        ? (product.price3 ?? product.price)
        : product.price,
  );

export function InvoiceEditor({
  currentUserName,
  submissionEnabled = true,
  submissionMessage,
  customers,
  products,
  warehouses,
  warehouseStocks,
  shipmentGuides,
  establishments,
  issuePoints,
  treasuryAccounts,
  initialCustomerId,
  initialLines,
  initialPaymentMethod,
  initialSriPaymentCode,
  aiDraftId,
  aiProposalId,
  draftId: initialDraftId,
  draftPayload,
}: {
  currentUserName: string;
  submissionEnabled?: boolean;
  submissionMessage?: string;
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  warehouseStocks: WarehouseStock[];
  shipmentGuides: ShipmentGuide[];
  establishments: Establishment[];
  issuePoints: IssuePoint[];
  treasuryAccounts: TreasuryAccountOption[];
  initialCustomerId?: string;
  initialLines?: Line[];
  initialPaymentMethod?: string;
  initialSriPaymentCode?: string;
  aiDraftId?: string;
  aiProposalId?: string;
  draftId?: string;
  draftPayload?: DraftPayload;
}) {
  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0] ?? null;
  const defaultEstablishment = establishments[0] ?? null;
  const defaultIssuePoint = issuePoints.find((ip) => ip.establishmentId === defaultEstablishment?.id) ?? null;

  const [customerId, setCustomerId] = useState(draftPayload?.customerId ?? initialCustomerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>(draftPayload?.lines ?? initialLines ?? []);
  const [priceTier, setPriceTier] = useState(draftPayload?.priceTier ?? "PVP1");
  const [paymentMethod, setPaymentMethod] = useState(draftPayload?.paymentMethod ?? initialPaymentMethod ?? "cash");
  const [payments, setPayments] = useState<PaymentEntry[]>(draftPayload?.payments ?? []);
  const [notes, setNotes] = useState(draftPayload?.notes ?? "");
  const [globalPct, setGlobalPct] = useState(draftPayload?.globalPct ?? 0);
  const [globalAmount, setGlobalAmount] = useState(draftPayload?.globalAmount ?? 0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const savingRef = useRef(false);
  const [warehouseId, setWarehouseId] = useState(draftPayload?.warehouseId ?? defaultWarehouse?.id ?? "");
  const [invoiceKind, setInvoiceKind] = useState<InvoiceKind>(draftPayload?.invoiceKind ?? "NORMAL");
  const [shipmentGuideId, setShipmentGuideId] = useState(draftPayload?.shipmentGuideId ?? "");
  const [shipmentGuideSearch, setShipmentGuideSearch] = useState("");
  const [guideDropdownOpen, setGuideDropdownOpen] = useState(false);
  const [establishmentId, setEstablishmentId] = useState(draftPayload?.establishmentId ?? defaultEstablishment?.id ?? "");
  const [issuePointId, setIssuePointId] = useState(draftPayload?.issuePointId ?? defaultIssuePoint?.id ?? "");
  const [exportData, setExportData] = useState<ExportData>(draftPayload?.exportData ?? { incoterm: "", destinationPort: "", countryCode: "", countryName: "" });
  const [reimbursementData, setReimbursementData] = useState<ReimbursementData>(draftPayload?.reimbursementData ?? { reimbursementDocType: "", reimbursementDocNumber: "", reimbursementTaxpayerId: "" });
  const [draftId, setDraftId] = useState(initialDraftId ?? "");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMultipleModal, setShowMultipleModal] = useState(false);
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<string | null>(null);

  const customerSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const guideSearchRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = customers.find((item) => item.id === customerId) ?? null;
  const selectedEstablishment = establishments.find((e) => e.id === establishmentId) ?? defaultEstablishment;
  const selectedIssuePoint = issuePoints.find((ip) => ip.id === issuePointId) ?? defaultIssuePoint;
  const filteredIssuePoints = issuePoints.filter((ip) => ip.establishmentId === establishmentId);

  const productById = useMemo(
    () => new Map(products.map((item) => [item.id, item])),
    [products],
  );

  const stockByWarehouseProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of warehouseStocks) {
      map.set(`${s.warehouseId}:${s.productId}`, s.quantity);
    }
    return map;
  }, [warehouseStocks]);

  const getStock = useCallback(
    (productId: string) => {
      if (!warehouseId) {
        const product = productById.get(productId);
        return product?.stock ?? 0;
      }
      return stockByWarehouseProduct.get(`${warehouseId}:${productId}`) ?? 0;
    },
    [warehouseId, productById, stockByWarehouseProduct],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
      if (guideSearchRef.current && !guideSearchRef.current.contains(e.target as Node)) {
        setGuideDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const customerMatches = customerSearch.trim()
    ? customers
        .filter((item) =>
          [item.identification, item.name, item.tradeName, item.email].some(
            (value) =>
              value?.toLowerCase().includes(customerSearch.toLowerCase()),
          ),
        )
        .slice(0, 8)
    : [];
  const productMatches = productSearch.trim()
    ? products
        .filter((item) =>
          [
            item.primaryCode,
            item.auxiliaryCode,
            item.name,
            item.description,
          ].some((value) =>
            value?.toLowerCase().includes(productSearch.toLowerCase()),
          ),
        )
        .slice(0, 10)
    : [];
  const guideMatches = shipmentGuideSearch.trim()
    ? shipmentGuides
        .filter((g) =>
          g.number.toLowerCase().includes(shipmentGuideSearch.toLowerCase()) ||
          g.destinationAddress.toLowerCase().includes(shipmentGuideSearch.toLowerCase()),
        )
        .slice(0, 8)
    : [];

  const calculated = lines.map((line) => {
    const product = productById.get(line.productId)!;
    const gross = line.unitPrice * line.quantity;
    const discount = Math.min(gross, (gross * line.discountPct) / 100);
    const subtotal = gross - discount;
    const taxRate = Number(product.taxRate);
    const cat = product.taxCategory ?? (taxRate > 0 ? "TAXABLE" : "ZERO");
    const effectiveRate = cat === "NON_OBJECT" || cat === "EXEMPT" ? 0 : taxRate;
    const tax = (subtotal * effectiveRate) / 100;
    return {
      ...line,
      product,
      gross,
      discount,
      subtotal,
      tax,
      total: subtotal + tax,
      taxCategory: cat,
      effectiveRate,
    };
  });

  const baseBeforeGlobal = calculated.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );
  const requestedGlobal = globalAmount || (baseBeforeGlobal * globalPct) / 100;
  const appliedGlobal = Math.min(
    baseBeforeGlobal,
    Math.max(0, requestedGlobal),
  );

  const taxBuckets = useMemo(() => {
    const buckets: Record<string, { label: string; base: number; rate: number }> = {};
    for (const item of calculated) {
      const share = baseBeforeGlobal
        ? (appliedGlobal * item.subtotal) / baseBeforeGlobal
        : 0;
      const adjusted = item.subtotal - share;
      const cat = item.taxCategory;
      const rate = item.effectiveRate;
      let key: string;
      let label: string;
      if (cat === "NON_OBJECT") {
        key = "non_object";
        label = "No Objeto de Impuesto";
      } else if (cat === "EXEMPT") {
        key = "exempt";
        label = "Exento de IVA";
      } else if (rate === 0) {
        key = "zero";
        label = "Subtotal 0%";
      } else {
        key = `rate_${rate}`;
        label = `Subtotal ${rate}%`;
      }
      if (!buckets[key]) buckets[key] = { label, base: 0, rate };
      buckets[key].base += adjusted;
    }
    return buckets;
  }, [calculated, baseBeforeGlobal, appliedGlobal]);

  const lineDiscount = calculated.reduce((sum, item) => sum + item.discount, 0);
  const taxTotal = Object.values(taxBuckets).reduce(
    (sum, b) => sum + (b.rate * b.base) / 100,
    0,
  );
  const subtotalAfterDiscount = Math.max(0, baseBeforeGlobal - appliedGlobal);
  const total = subtotalAfterDiscount + taxTotal;
  const dirty = lines.length > 0 || Boolean(customerId || notes);

  function addProduct(product: Product) {
    const stock = getStock(product.id);
    setLines((current) => {
      const existing = current.find((item) => item.productId === product.id);
      return existing
        ? current.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.min(stock, item.quantity + 1) }
              : item,
          )
        : [
            ...current,
            {
              productId: product.id,
              quantity: 1,
              unitPrice: priceFor(product, priceTier),
              discountPct: 0,
              description: "",
            },
          ];
    });
    setProductSearch("");
    setProductDropdownOpen(false);
    setSaved(null);
  }

  function updateLine(productId: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, ...patch } : item,
      ),
    );
    setSaved(null);
  }

  function reset() {
    if (dirty && !window.confirm("¿Limpiar la factura actual?")) return;
    setCustomerId("");
    setCustomerSearch("");
    setProductSearch("");
    setLines([]);
    setNotes("");
    setGlobalPct(0);
    setGlobalAmount(0);
    setSaved(null);
    setMessage("");
    setPaymentMethod("cash");
    setPayments([]);
    setInvoiceKind("NORMAL");
    setShipmentGuideId("");
    setShipmentGuideSearch("");
    setExportData({ incoterm: "", destinationPort: "", countryCode: "", countryName: "" });
    setReimbursementData({ reimbursementDocType: "", reimbursementDocNumber: "", reimbursementTaxpayerId: "" });
    setDraftId("");
  }

  function buildItems() {
    return calculated.map((item) => {
      const globalShare = baseBeforeGlobal
        ? (appliedGlobal * item.subtotal) / baseBeforeGlobal
        : 0;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: Number((item.discount + globalShare).toFixed(2)),
        description: item.description,
      };
    });
  }

  function buildPaymentsPayload() {
    if (paymentMethod === "multiple" && payments.length > 0) {
      return payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        treasuryAccountId: p.accountId || undefined,
        referenceNumber: p.referenceNumber || undefined,
        batchNumber: p.batchNumber || undefined,
        voucherNumber: p.voucherNumber || undefined,
        dueDate: p.dueDate || undefined,
      }));
    }
    if (payments.length === 1) {
      const p = payments[0];
      return [{
        method: p.method,
        amount: p.amount,
        treasuryAccountId: p.accountId || undefined,
        referenceNumber: p.referenceNumber || undefined,
        batchNumber: p.batchNumber || undefined,
        voucherNumber: p.voucherNumber || undefined,
        dueDate: p.dueDate || undefined,
      }];
    }
    return undefined;
  }

  function openPaymentSelection(method: string) {
    if (method === "multiple") {
      setShowMultipleModal(true);
    } else {
      setSinglePaymentMethod(method);
      setShowPaymentModal(true);
    }
  }

  function handleSinglePaymentSave(entry: PaymentEntry) {
    setPayments([entry]);
    setShowPaymentModal(false);
    setSinglePaymentMethod(null);
  }

  function handleMultiplePaymentSave(entries: PaymentEntry[]) {
    setPayments(entries);
    setShowMultipleModal(false);
  }

  async function saveDraft() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const payload: DraftPayload = {
        customerId,
        lines,
        paymentMethod,
        payments,
        notes,
        priceTier,
        globalPct,
        globalAmount,
        warehouseId,
        invoiceKind,
        shipmentGuideId,
        establishmentId,
        issuePointId,
        exportData,
        reimbursementData,
      };
      if (draftId) {
        const response = await fetch(`/api/facturacion/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const result = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok || !result.ok) throw new Error(result.message ?? "No se pudo actualizar borrador.");
        setMessage("Borrador actualizado.");
      } else {
        const response = await fetch("/api/facturacion/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const result = (await response.json()) as { ok?: boolean; message?: string; draft?: { id: string } };
        if (!response.ok || !result.ok) throw new Error(result.message ?? "No se pudo crear borrador.");
        setDraftId(result.draft!.id);
        setMessage("Borrador guardado.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al guardar borrador.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function save(sendToSri: boolean) {
    if (savingRef.current || saved) return;
    if (!submissionEnabled) {
      setMessage(
        submissionMessage ??
          "La creación de facturas está temporalmente no disponible para este motor.",
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      if (!lines.length) throw new Error("Agrega al menos un producto.");

      const paymentsPayload = buildPaymentsPayload();
      const effectiveMethod = paymentMethod === "multiple"
        ? (payments[0]?.method ?? "cash")
        : paymentMethod;
      const creditPayment = payments.find((p) => p.method === "credit");

      const response = await fetch("/api/basic/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          paymentMethod: effectiveMethod,
          paidAmount: effectiveMethod === "credit" ? 0 : total,
          outputMode: sendToSri ? "sri_invoice" : "internal_receipt",
          sriPaymentCode: COMMERCIAL_TO_SRI[effectiveMethod] ?? "01",
          notes,
          items: buildItems(),
          payments: paymentsPayload,
          warehouseId: warehouseId || undefined,
          invoiceKind: invoiceKind !== "NORMAL" ? invoiceKind : undefined,
          dueDate: creditPayment?.dueDate || undefined,
          shipmentGuideId: shipmentGuideId || undefined,
          exportData: invoiceKind === "EXPORT" ? exportData : undefined,
          reimbursementData: invoiceKind === "REIMBURSEMENT" ? reimbursementData : undefined,
          establishmentId: establishmentId || undefined,
          issuePointId: issuePointId || undefined,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        sale?: { id: string };
        output?: {
          status?: string;
          errorMessage?: string;
          sri?: {
            documentId: string;
            flowState: SavedResult["flowState"];
            flowLabel: string;
          };
        };
      };
      if (!response.ok || !result.ok || !result.sale)
        throw new Error(result.message ?? "No se pudo guardar la factura.");

      if (aiDraftId) {
        try {
          await fetch(`/api/ai-invoicing/drafts/${aiDraftId}/convert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ saleId: result.sale.id }),
          });
        } catch { /* best effort */ }
      }

      if (draftId) {
        try {
          await fetch(`/api/facturacion/drafts/${draftId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "CONVERTED", convertedSaleId: result.sale.id }),
          });
        } catch { /* best effort */ }
      }

      setSaved({
        saleId: result.sale.id,
        documentId: result.output?.sri?.documentId,
        flowState: result.output?.sri?.flowState,
        flowLabel: result.output?.sri?.flowLabel,
      });
      setMessage(
        result.output?.errorMessage ??
          (sendToSri
            ? "Venta guardada y flujo SRI iniciado."
            : "Venta guardada. Ya puedes enviarla al SRI."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function sendSaved() {
    if (savingRef.current) return;
    if (!submissionEnabled) {
      setMessage(
        submissionMessage ??
          "El envío de facturas está temporalmente no disponible para este motor.",
      );
      return;
    }
    if (!saved) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/sri/documents/from-basic-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: saved.saleId }),
      });
      const result = (await response.json()) as {
        error?: string;
        documentId?: string;
        flowState?: SavedResult["flowState"];
        flowLabel?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "No se pudo iniciar el envío.");
      setSaved({
        ...saved,
        documentId: result.documentId,
        flowState: result.flowState,
        flowLabel: result.flowLabel,
      });
      setMessage(result.message ?? "Flujo SRI iniciado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const status = saved?.flowLabel ?? (saved ? "Guardada" : draftId ? "Borrador guardado" : "Borrador local");
  const statusClass =
    saved?.flowState === "authorized"
      ? "bg-emerald-50 text-emerald-700"
      : saved?.flowState === "rejected"
        ? "bg-red-50 text-red-700"
        : saved?.flowState === "preparing"
          ? "bg-amber-50 text-amber-700"
          : saved?.flowState
            ? "bg-blue-50 text-blue-700"
            : "bg-slate-100 text-slate-600";

  const paymentSummary = paymentMethod === "multiple" && payments.length > 0
    ? `Múltiple (${payments.length} pagos)`
    : payments.length === 1
      ? `${COMMERCIAL_LABELS[payments[0].method] ?? payments[0].method} — ${payments[0].accountName || ""}`
      : PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label ?? paymentMethod;

  return (
    <div className="space-y-4 pb-10">
      <header className="sticky top-0 z-30 -mx-3 flex flex-wrap items-center justify-between gap-2 border-b bg-white/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-[#172033]">Nueva factura</h1>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}>
            {status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={reset}>
            <Plus />
            Nueva factura
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving || Boolean(saved)}
            onClick={saveDraft}
          >
            <Save />
            Guardar borrador
          </Button>
          <Button
            size="sm"
            className="bg-[#1E52F1] text-white"
            disabled={!submissionEnabled || saving || !lines.length || Boolean(saved)}
            title={!submissionEnabled ? submissionMessage : undefined}
            onClick={() => save(true)}
          >
            <Send />
            Guardar y enviar al SRI
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!submissionEnabled || saving || !saved || Boolean(saved?.documentId)}
            title={!submissionEnabled ? submissionMessage : undefined}
            onClick={sendSaved}
          >
            <Send />
            Enviar al SRI
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saved?.flowState !== "authorized" || !saved?.documentId}
            onClick={() => {
              if (saved?.documentId)
                window.location.href = `/api/sri/documents/${saved.documentId}/download-ride`;
            }}
          >
            <FileDown />
            RIDE
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!saved}
            onClick={() => {
              if (saved)
                window.location.href = `/api/basic/sales/${saved.saleId}/download-receipt`;
            }}
          >
            <ReceiptText />
            Ticket
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/facturacion/documents">
              <ArrowLeft />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      {!submissionEnabled && submissionMessage ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-[#667085]">
          {submissionMessage}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-[#667085]">
          {message}
        </p>
      ) : null}

      <fieldset disabled={Boolean(saved)} className="contents">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Invoice data card */}
          <Card title="Datos de factura">
            <div className="grid gap-3 sm:grid-cols-2">
              {establishments.length > 1 ? (
                <Field label="Establecimiento">
                  <select
                    className="h-8 rounded-lg border px-2 text-sm"
                    value={establishmentId}
                    onChange={(e) => {
                      setEstablishmentId(e.target.value);
                      const firstIp = issuePoints.find((ip) => ip.establishmentId === e.target.value);
                      if (firstIp) setIssuePointId(firstIp.id);
                    }}
                  >
                    {establishments.map((e) => (
                      <option key={e.id} value={e.id}>{e.code} · {e.name}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Establecimiento">
                  <Input
                    readOnly
                    value={
                      selectedEstablishment
                        ? `${selectedEstablishment.code} · ${selectedEstablishment.name}`
                        : "Configuración SRI pendiente"
                    }
                  />
                </Field>
              )}
              {filteredIssuePoints.length > 1 ? (
                <Field label="Punto de emisión">
                  <select
                    className="h-8 rounded-lg border px-2 text-sm"
                    value={issuePointId}
                    onChange={(e) => setIssuePointId(e.target.value)}
                  >
                    {filteredIssuePoints.map((ip) => (
                      <option key={ip.id} value={ip.id}>{ip.code} · {ip.name}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Punto de emisión">
                  <Input
                    readOnly
                    value={
                      selectedIssuePoint
                        ? `${selectedIssuePoint.code} · ${selectedIssuePoint.name}`
                        : "—"
                    }
                  />
                </Field>
              )}
              <Field label="Fecha de emisión">
                <Input
                  readOnly
                  value={new Intl.DateTimeFormat("es-EC", {
                    dateStyle: "medium",
                  }).format(new Date())}
                />
              </Field>
              <Field label="Tipo de factura">
                <select
                  className="h-8 rounded-lg border px-2 text-sm"
                  value={invoiceKind}
                  onChange={(e) => setInvoiceKind(e.target.value as InvoiceKind)}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="EXPORT">Exportación</option>
                  <option value="REIMBURSEMENT">Reembolso</option>
                </select>
              </Field>
              <Field label="Vendedor">
                <Input readOnly value={currentUserName} />
              </Field>
              <Field label="Forma de pago">
                <div className="flex gap-1">
                  <select
                    className="h-8 flex-1 rounded-lg border px-2 text-sm"
                    value={paymentMethod}
                    onChange={(e) => {
                      const m = e.target.value;
                      setPaymentMethod(m);
                      if (m !== "multiple") {
                        setPayments([]);
                      }
                    }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openPaymentSelection(paymentMethod)}
                  >
                    Configurar
                  </Button>
                </div>
              </Field>
            </div>
            {payments.length > 0 && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Pago: </span>
                <span className="font-medium">{paymentSummary}</span>
              </div>
            )}
          </Card>

          {/* Customer card */}
          <Card title="Cliente">
            <div className="relative" ref={customerSearchRef}>
              <Label>Buscar cliente</Label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 size-4 text-slate-400" />
                  <Input
                    className="pl-9 pr-8"
                    value={customerSearch}
                    onChange={(event) => {
                      setCustomerSearch(event.target.value);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    placeholder="Identificación, nombre, nombre comercial o email"
                  />
                  {(customerId || customerSearch) && (
                    <button
                      type="button"
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        setCustomerId("");
                        setCustomerSearch("");
                        setCustomerDropdownOpen(false);
                        setSaved(null);
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                  {customerDropdownOpen && customerMatches.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
                      {customerMatches.map((item) => (
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          key={item.id}
                          onClick={() => {
                            setCustomerId(item.id);
                            setCustomerSearch(item.name);
                            setCustomerDropdownOpen(false);
                            setSaved(null);
                          }}
                        >
                          {item.name} · {item.identification ?? "Sin identificación"}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button asChild variant="outline">
                  <Link href="/facturacion/customers/new">+ Nuevo cliente</Link>
                </Button>
              </div>
            </div>
            {selectedCustomer ? (
              <div className="mt-3 grid gap-1 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                <p><b>{selectedCustomer.name}</b></p>
                <p>{selectedCustomer.identification ?? "—"}</p>
                <p>{selectedCustomer.tradeName ?? "—"}</p>
                <p>{selectedCustomer.phone ?? "—"}</p>
                <p>{selectedCustomer.address ?? "—"}</p>
                <p>{selectedCustomer.email ?? "—"}</p>
              </div>
            ) : (
              <button
                type="button"
                className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-700"
                onClick={() => {
                  setCustomerId("");
                  setCustomerSearch("CONSUMIDOR FINAL · 9999999999999");
                }}
              >
                CONSUMIDOR FINAL · 9999999999999
              </button>
            )}
            <div className="mt-3">
              <Label>Observación</Label>
              <Input
                className="mt-1"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setSaved(null);
                }}
                placeholder="Opcional"
              />
            </div>
          </Card>
        </div>

        {/* Export section */}
        {invoiceKind === "EXPORT" && (
          <Card title="Datos de exportación">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Incoterm">
                <Input value={exportData.incoterm} onChange={(e) => setExportData({ ...exportData, incoterm: e.target.value })} placeholder="FOB, CIF, etc." />
              </Field>
              <Field label="Puerto de destino">
                <Input value={exportData.destinationPort} onChange={(e) => setExportData({ ...exportData, destinationPort: e.target.value })} />
              </Field>
              <Field label="Código de país">
                <Input value={exportData.countryCode} onChange={(e) => setExportData({ ...exportData, countryCode: e.target.value })} placeholder="EC, US, etc." />
              </Field>
              <Field label="País de destino">
                <Input value={exportData.countryName} onChange={(e) => setExportData({ ...exportData, countryName: e.target.value })} />
              </Field>
            </div>
          </Card>
        )}

        {/* Reimbursement section */}
        {invoiceKind === "REIMBURSEMENT" && (
          <Card title="Datos de reembolso">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tipo de doc. reembolso">
                <Input value={reimbursementData.reimbursementDocType} onChange={(e) => setReimbursementData({ ...reimbursementData, reimbursementDocType: e.target.value })} placeholder="01, 02, etc." />
              </Field>
              <Field label="Nro. doc. reembolso">
                <Input value={reimbursementData.reimbursementDocNumber} onChange={(e) => setReimbursementData({ ...reimbursementData, reimbursementDocNumber: e.target.value })} />
              </Field>
              <Field label="RUC proveedor reembolso">
                <Input value={reimbursementData.reimbursementTaxpayerId} onChange={(e) => setReimbursementData({ ...reimbursementData, reimbursementTaxpayerId: e.target.value })} />
              </Field>
            </div>
          </Card>
        )}

        {/* Shipment guide */}
        {shipmentGuides.length > 0 && (
          <Card title="Guía de remisión">
            <div className="relative" ref={guideSearchRef}>
              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  <Label>Buscar guía</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-2 size-4 text-slate-400" />
                    <Input
                      className="pl-9 pr-8"
                      value={shipmentGuideSearch}
                      onChange={(e) => {
                        setShipmentGuideSearch(e.target.value);
                        setGuideDropdownOpen(true);
                      }}
                      onFocus={() => setGuideDropdownOpen(true)}
                      placeholder="Número de guía o dirección"
                    />
                    {shipmentGuideId && (
                      <button
                        type="button"
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        onClick={() => {
                          setShipmentGuideId("");
                          setShipmentGuideSearch("");
                          setGuideDropdownOpen(false);
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  {guideDropdownOpen && guideMatches.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
                      {guideMatches.map((g) => (
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          key={g.id}
                          onClick={() => {
                            setShipmentGuideId(g.id);
                            setShipmentGuideSearch(g.number);
                            setGuideDropdownOpen(false);
                          }}
                        >
                          {g.number} · {g.destinationAddress}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {shipmentGuideId && (
                  <p className="pb-1 text-sm text-slate-500">
                    Guía: {shipmentGuides.find((g) => g.id === shipmentGuideId)?.number ?? "—"}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Detail + totals */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
          <Card title="Detalle de factura">
            <div className="mb-3 grid gap-2 md:grid-cols-[180px_150px_minmax(0,1fr)]">
              {warehouses.length > 1 ? (
                <select
                  aria-label="Bodega"
                  className="h-8 rounded-lg border px-2 text-sm"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.isDefault ? " (Principal)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <Input readOnly value={warehouses[0]?.name ?? "Bodega general"} aria-label="Bodega" />
              )}
              <select
                aria-label="Lista de precios"
                className="h-8 rounded-lg border px-2 text-sm"
                value={priceTier}
                onChange={(event) => setPriceTier(event.target.value)}
              >
                <option>PVP1</option>
                <option disabled={!products.some((item) => item.price2)}>PVP2</option>
                <option disabled={!products.some((item) => item.price3)}>PVP3</option>
              </select>
              <div className="relative" ref={productSearchRef}>
                <Search className="absolute left-3 top-2 size-4 text-slate-400" />
                <Input
                  className="pl-9"
                  value={productSearch}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setProductDropdownOpen(true);
                  }}
                  onFocus={() => setProductDropdownOpen(true)}
                  placeholder="Código principal, auxiliar, nombre o descripción"
                />
                {productDropdownOpen && productMatches.length > 0 ? (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
                    {productMatches.map((item) => {
                      const stock = getStock(item.id);
                      return (
                        <button
                          type="button"
                          className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                          disabled={stock <= 0 && item.stock !== 999999}
                          key={item.id}
                          onClick={() => addProduct(item)}
                        >
                          <span>
                            {item.name} · {item.primaryCode ?? item.auxiliaryCode ?? "—"}
                          </span>
                          <span>
                            {money(priceFor(item, priceTier))} · Stock {stock}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {[
                      "#",
                      "Producto / Código",
                      "Observación",
                      "Stock",
                      "Cantidad",
                      "Precio",
                      "IVA",
                      "Desc. %",
                      "Desc. $",
                      "Subtotal",
                      "Total",
                      "",
                    ].map((label) => (
                      <th className="px-2 py-2 font-medium" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calculated.map((item, index) => {
                    const stock = getStock(item.productId);
                    const taxLabel = item.taxCategory === "NON_OBJECT"
                      ? "N/O"
                      : item.taxCategory === "EXEMPT"
                        ? "Ext."
                        : `${item.effectiveRate}%`;
                    return (
                      <tr key={item.productId}>
                        <td className="px-2">{index + 1}</td>
                        <td className="px-2 font-medium">
                          {item.product.name}
                          <br />
                          <span className="font-normal text-slate-400">
                            {item.product.primaryCode ?? item.product.auxiliaryCode ?? "—"}
                          </span>
                        </td>
                        <td className="px-2">
                          <Input
                            className="h-7 w-36"
                            value={item.description}
                            onChange={(event) =>
                              updateLine(item.productId, { description: event.target.value })
                            }
                          />
                        </td>
                        <td className="px-2">{stock}</td>
                        <td className="px-2">
                          <EditableNumberInput
                            className="h-7 w-16"
                            value={item.quantity}
                            onChange={(v) =>
                              updateLine(item.productId, {
                                quantity: Math.max(1, Math.min(stock, Math.round(v))),
                              })
                            }
                            min={1}
                            max={stock}
                            fallback={1}
                          />
                        </td>
                        <td className="px-2">
                          <EditableNumberInput
                            className="h-7 w-24"
                            value={item.unitPrice}
                            onChange={(v) =>
                              updateLine(item.productId, { unitPrice: Math.max(0, v) })
                            }
                            min={0}
                            step="0.01"
                            fallback={priceFor(item.product, priceTier)}
                          />
                        </td>
                        <td className="px-2">{taxLabel}</td>
                        <td className="px-2">
                          <EditableNumberInput
                            className="h-7 w-16"
                            value={item.discountPct}
                            onChange={(v) =>
                              updateLine(item.productId, {
                                discountPct: Math.max(0, Math.min(100, v)),
                              })
                            }
                            min={0}
                            max={100}
                            fallback={0}
                          />
                        </td>
                        <td className="px-2">{money(item.discount)}</td>
                        <td className="px-2">{money(item.subtotal)}</td>
                        <td className="px-2 font-semibold">{money(item.total)}</td>
                        <td className="px-2">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              setLines((current) =>
                                current.filter((line) => line.productId !== item.productId),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!lines.length ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  Busca un producto para comenzar.
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Descuento global %">
                <EditableNumberInput
                  className="w-24"
                  value={globalPct}
                  onChange={(v) => {
                    setGlobalPct(v);
                    setGlobalAmount(0);
                    setSaved(null);
                  }}
                  min={0}
                  max={100}
                  fallback={0}
                />
              </Field>
              <Field label="Descuento global $">
                <EditableNumberInput
                  className="w-28"
                  value={globalAmount}
                  onChange={(v) => {
                    setGlobalAmount(v);
                    setGlobalPct(0);
                    setSaved(null);
                  }}
                  min={0}
                  step="0.01"
                  fallback={0}
                />
              </Field>
            </div>
          </Card>

          {/* Totals sidebar */}
          <aside className="h-fit rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Totales</h2>
            {Object.entries(taxBuckets)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, bucket]) => (
                <Total key={key} label={bucket.label} value={bucket.base} />
              ))}
            {lineDiscount + appliedGlobal > 0 ? (
              <Total label="Descuento" value={-(lineDiscount + appliedGlobal)} />
            ) : null}
            <Total label="Subtotal" value={subtotalAfterDiscount} />
            {Object.entries(taxBuckets)
              .filter(([, b]) => b.rate > 0)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, bucket]) => (
                <Total
                  key={`tax_${key}`}
                  label={`IVA ${bucket.rate}%`}
                  value={(bucket.rate * bucket.base) / 100}
                />
              ))}
            <div className="my-3 border-t" />
            <div className="flex items-end justify-between">
              <span className="font-semibold">TOTAL A PAGAR</span>
              <strong className="text-2xl text-[#172033]">{money(total)}</strong>
            </div>
            <Button
              className="mt-4 w-full bg-[#1E52F1] text-white"
              disabled={!submissionEnabled || saving || !lines.length || Boolean(saved)}
              title={!submissionEnabled ? submissionMessage : undefined}
              onClick={() => save(false)}
            >
              {saving ? "Guardando..." : "Guardar factura"}
            </Button>
          </aside>
        </div>
      </fieldset>

      {/* Payment modals */}
      {showPaymentModal && singlePaymentMethod && (
        <PaymentModal
          method={singlePaymentMethod}
          accounts={treasuryAccounts}
          invoiceTotal={total}
          pendingAmount={total}
          customerName={selectedCustomer?.name ?? null}
          hasCustomer={Boolean(customerId)}
          onSave={handleSinglePaymentSave}
          onClose={() => {
            setShowPaymentModal(false);
            setSinglePaymentMethod(null);
          }}
        />
      )}
      {showMultipleModal && (
        <MultiplePaymentModal
          accounts={treasuryAccounts}
          invoiceTotal={total}
          customerName={selectedCustomer?.name ?? null}
          hasCustomer={Boolean(customerId)}
          initialPayments={payments}
          onSave={handleMultiplePaymentSave}
          onClose={() => setShowMultipleModal(false)}
        />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 font-semibold text-[#172033]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}
