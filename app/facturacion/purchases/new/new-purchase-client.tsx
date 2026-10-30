"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ItemRow = {
  xmlProductCode: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  discountAmount: string;
  taxRate: string;
  warehouseId: string;
};

type Supplier = {
  id: string;
  name: string;
  identification: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type Establishment = { id: string; code: string; name: string };
type CostCenter = { id: string; code: string; name: string };
type Warehouse = { id: string; name: string; code: string };

const DOCUMENT_TYPES: Record<string, string> = {
  INVOICE: "01 · Factura",
  CREDIT_NOTE: "04 · Nota de crédito",
  DEBIT_NOTE: "05 · Nota de débito",
  OTHER: "Otro",
};

const SRI_PAYMENT_CODES = [
  { code: "01", label: "01 — SIN UTILIZACIÓN DEL SISTEMA FINANCIERO" },
  { code: "15", label: "15 — COMPENSACIÓN DE DEUDAS" },
  { code: "16", label: "16 — TARJETA DE DÉBITO" },
  { code: "17", label: "17 — DINERO ELECTRÓNICO" },
  { code: "18", label: "18 — TARJETA PREPAGO" },
  { code: "19", label: "19 — TARJETA DE CRÉDITO" },
  { code: "20", label: "20 — OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO" },
  { code: "21", label: "21 — ENDOSO DE TÍTULOS" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "check", label: "Cheque" },
  { value: "deposit", label: "Depósito" },
  { value: "transfer", label: "Transferencia" },
  { value: "debit", label: "Débito" },
  { value: "card", label: "Tarjeta" },
  { value: "credit", label: "Crédito" },
  { value: "multiple", label: "Múltiple" },
];

type TaxSupportEntry = {
  code: string;
  description: string;
  compatibleDocumentTypes: string[];
};

function emptyItem(): ItemRow {
  return { xmlProductCode: "", productId: "", description: "", quantity: "1", unitPrice: "0", discountPct: "0", discountAmount: "0", taxRate: "15", warehouseId: "" };
}

function normalizeDocNumber(e: string, p: string, s: string): string {
  return `${e.padStart(3, "0")}-${p.padStart(3, "0")}-${s.padStart(9, "0")}`;
}

function parseNum(v: string): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function NewPurchaseClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [projects, setProjects] = useState<CostCenter[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [taxSupportCatalog, setTaxSupportCatalog] = useState<TaxSupportEntry[]>([]);

  const [establishmentId, setEstablishmentId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [documentType, setDocumentType] = useState("INVOICE");
  const [docEstab, setDocEstab] = useState("001");
  const [docPoint, setDocPoint] = useState("001");
  const [docSeq, setDocSeq] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [purchaseType, setPurchaseType] = useState("EXPENSE_SERVICE");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [sriPaymentCode, setSriPaymentCode] = useState("01");
  const [taxSupportCode, setTaxSupportCode] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [withholding, setWithholding] = useState(false);
  const [notes, setNotes] = useState("");
  const [tipAmount, setTipAmount] = useState("0");

  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierIdentification, setSupplierIdentification] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sri/establishments").then((r) => r.json()).then((d) => {
      const list = (d.establishments ?? d ?? []) as Establishment[];
      setEstablishments(list);
      if (list.length > 0 && !establishmentId) setEstablishmentId(list[0]!.id);
    }).catch(() => {});

    fetch("/api/accounting/cost-centers").then((r) => r.json()).then((d) => {
      const all = (d.costCenters ?? d ?? []) as (CostCenter & { type: string })[];
      setCostCenters(all.filter((c) => c.type === "COST_CENTER"));
      setProjects(all.filter((c) => c.type === "PROJECT"));
    }).catch(() => {});

    fetch("/api/inventory/warehouses").then((r) => r.json()).then((d) => {
      setWarehouses((d.warehouses ?? d ?? []) as Warehouse[]);
    }).catch(() => {});

    setTaxSupportCatalog([
      { code: "01", description: "Crédito tributario para declaración de IVA", compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"] },
      { code: "02", description: "Costo o gasto para declaración de IR", compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"] },
      { code: "03", description: "Activo fijo — Crédito tributario para IVA", compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"] },
      { code: "04", description: "Activo fijo — Costo o gasto para IR", compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"] },
      { code: "05", description: "Liquidación gastos de viaje, hospedaje y alimentación", compatibleDocumentTypes: ["INVOICE", "PURCHASE_SETTLEMENT"] },
      { code: "06", description: "Inventario — Crédito tributario para IVA", compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"] },
      { code: "07", description: "Inventario — Costo o gasto para IR", compatibleDocumentTypes: ["INVOICE", "DEBIT_NOTE", "CREDIT_NOTE"] },
      { code: "08", description: "Valor pagado para solicitar reembolso de gasto", compatibleDocumentTypes: ["INVOICE", "PURCHASE_SETTLEMENT"] },
      { code: "09", description: "Reembolso por siniestros", compatibleDocumentTypes: ["INVOICE"] },
      { code: "10", description: "Distribución de dividendos, beneficios o utilidades", compatibleDocumentTypes: ["INVOICE", "PURCHASE_SETTLEMENT"] },
      { code: "11", description: "Convenios de débito o recaudación para IFI", compatibleDocumentTypes: ["INVOICE"] },
      { code: "12", description: "Impuestos y retenciones presuntivos", compatibleDocumentTypes: ["INVOICE"] },
      { code: "13", description: "Valores reconocidos por entidades del sector público", compatibleDocumentTypes: ["INVOICE"] },
      { code: "14", description: "Valores facturados por socios a operadoras de transporte", compatibleDocumentTypes: ["INVOICE"] },
      { code: "15", description: "Pagos por consumos propios/terceros de servicios digitales", compatibleDocumentTypes: ["INVOICE"] },
    ]);
  }, []);

  const filteredTaxSupport = taxSupportCatalog.filter((e) =>
    e.compatibleDocumentTypes.includes(documentType),
  );

  useEffect(() => {
    if (purchaseType === "MERCHANDISE" && !taxSupportCode) setTaxSupportCode("06");
    else if (purchaseType === "EXPENSE_SERVICE" && !taxSupportCode) setTaxSupportCode("01");
  }, [purchaseType]);

  const searchSupplier = useCallback(async (q: string) => {
    setSupplierSearch(q);
    if (q.length < 2) { setShowSupplierDropdown(false); return; }
    try {
      const res = await fetch(`/api/suppliers?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setSupplierResults(data.suppliers ?? data ?? []);
      setShowSupplierDropdown(true);
    } catch { setShowSupplierDropdown(false); }
  }, []);

  function selectSupplier(s: Supplier) {
    setSupplierId(s.id);
    setSupplierName(s.name);
    setSupplierIdentification(s.identification);
    setSupplierPhone(s.phone ?? "");
    setSupplierEmail(s.email ?? "");
    setSupplierAddress(s.address ?? "");
    setSupplierSearch(s.name);
    setShowSupplierDropdown(false);
  }

  function addItem() { setItems([...items, emptyItem()]); }

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    const next = [...items];
    const row = { ...next[index]!, [field]: value };

    if (field === "discountPct") {
      const sub = parseNum(row.quantity) * parseNum(row.unitPrice);
      row.discountAmount = String(Math.round(sub * parseNum(value) / 100 * 100) / 100);
    }

    next[index] = row;
    setItems(next);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function computeItemSubtotal(item: ItemRow): number {
    return parseNum(item.quantity) * parseNum(item.unitPrice) - parseNum(item.discountAmount);
  }

  const subtotalDif0 = items.reduce((s, it) => parseNum(it.taxRate) > 0 ? s + computeItemSubtotal(it) : s, 0);
  const subtotal0 = items.reduce((s, it) => parseNum(it.taxRate) === 0 ? s + computeItemSubtotal(it) : s, 0);
  const discountTotal = items.reduce((s, it) => s + parseNum(it.discountAmount), 0);
  const ivaTotal = items.reduce((s, it) => {
    const sub = computeItemSubtotal(it);
    return s + sub * (parseNum(it.taxRate) / 100);
  }, 0);
  const tip = parseNum(tipAmount);
  const totalFactura = subtotalDif0 + subtotal0 + ivaTotal + tip;

  async function handleImportXml() {
    fileInputRef.current?.click();
  }

  async function onXmlFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await fetch("/api/purchases/import-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml: text, parseOnly: true }),
      });
      const data = await res.json();
      if (data.parsed) {
        const p = data.parsed;
        if (p.legalName) { setSupplierName(p.legalName); setSupplierSearch(p.legalName); }
        if (p.rucEmitter) setSupplierIdentification(p.rucEmitter);
        if (p.documentNumber) {
          const parts = p.documentNumber.split("-");
          if (parts.length === 3) { setDocEstab(parts[0]!); setDocPoint(parts[1]!); setDocSeq(parts[2]!); }
        }
        if (p.accessKey) setAccessKey(p.accessKey);
        if (p.issueDate) {
          const parts = p.issueDate.split("/");
          if (parts.length === 3) setIssueDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        if (p.documentType) setDocumentType(p.documentType);
        if (p.sriPaymentCode) setSriPaymentCode(p.sriPaymentCode);
        if (p.items?.length > 0) {
          setItems(p.items.map((it: { xmlProductCode?: string; description: string; quantity: number; unitPrice: number; discountAmount: number; taxRate: number }) => ({
            xmlProductCode: it.xmlProductCode ?? "",
            productId: "",
            description: it.description,
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
            discountPct: "0",
            discountAmount: String(it.discountAmount),
            taxRate: String(it.taxRate),
            warehouseId: "",
          })));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar XML");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave(asDraft: boolean) {
    setSaving(true);
    setError("");
    try {
      const docNumber = normalizeDocNumber(docEstab, docPoint, docSeq);
      const body = {
        supplierId: supplierId || undefined,
        supplierName: supplierName || undefined,
        supplierIdentification: supplierIdentification || undefined,
        documentType,
        supplierDocumentNumber: docNumber !== "000-000-000000000" ? docNumber : undefined,
        accessKey: accessKey || undefined,
        issueDate: issueDate ? new Date(issueDate).toISOString() : undefined,
        purchaseType: purchaseType || undefined,
        paymentMethod,
        sriPaymentCode: sriPaymentCode || undefined,
        taxSupportCode: taxSupportCode || undefined,
        accountingCostCenterId: costCenterId || undefined,
        accountingProjectId: projectId || undefined,
        tipAmount: tip,
        notes: notes || undefined,
        subtotal0,
        subtotal15: subtotalDif0,
        ivaTotal,
        discountTotal,
        total: totalFactura,
        status: asDraft ? "DRAFT" : "REGISTERED",
        items: items.filter((it) => it.description.trim()).map((it) => ({
          productId: it.productId || undefined,
          xmlProductCode: it.xmlProductCode || undefined,
          description: it.description,
          quantity: parseNum(it.quantity),
          unitPrice: parseNum(it.unitPrice),
          discountAmount: parseNum(it.discountAmount),
          taxRate: parseNum(it.taxRate),
        })),
        payments: paymentMethod !== "credit" && !asDraft ? [{ method: paymentMethod, amount: totalFactura }] : undefined,
      };

      const res = await fetch("/api/purchases/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error al guardar.");

      if (withholding && data.document?.id) {
        router.push(`/facturacion/purchases/withholdings/new?purchaseDocumentId=${data.document.id}`);
      } else {
        router.push("/facturacion/purchases/documents");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        const el = document.getElementById("product-search-0");
        el?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registrar compra</h1>
          <p className="text-sm text-muted-foreground">Registra un documento de compra recibido</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/facturacion/purchases/documents")}>Volver</Button>
          <Button variant="outline" size="sm" onClick={handleImportXml}>Importar XML</Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(true)} disabled={saving}>Guardar borrador</Button>
          <Button size="sm" onClick={() => handleSave(false)} disabled={saving}>{saving ? "Guardando..." : "Registrar compra"}</Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".xml" className="hidden" onChange={onXmlFileSelected} />

      {/* Datos de compra */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium text-[#1769E0]">Datos de compra</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Establecimiento</label>
              <select value={establishmentId} onChange={(e) => setEstablishmentId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                {establishments.map((est) => (
                  <option key={est.id} value={est.id}>{est.code} · {est.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Fecha de emisión *</label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de documento</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                {Object.entries(DOCUMENT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Número documento</label>
              <div className="flex gap-1">
                <Input value={docEstab} onChange={(e) => setDocEstab(e.target.value)} className="w-16 text-center font-mono text-xs" maxLength={3} placeholder="001" />
                <Input value={docPoint} onChange={(e) => setDocPoint(e.target.value)} className="w-16 text-center font-mono text-xs" maxLength={3} placeholder="001" />
                <Input value={docSeq} onChange={(e) => setDocSeq(e.target.value)} className="flex-1 font-mono text-xs" maxLength={9} placeholder="000000001" />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Clave de acceso</label>
              <Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} className="font-mono text-xs" maxLength={49} placeholder="49 dígitos" />
              {accessKey && accessKey.length !== 49 && (
                <p className="text-xs text-amber-600 mt-1">La clave de acceso debe tener 49 dígitos</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de compra</label>
              <select value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="MERCHANDISE">Mercadería</option>
                <option value="EXPENSE_SERVICE">Gastos y servicios</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Forma de pago</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Pag. SRI</label>
              <select value={sriPaymentCode} onChange={(e) => setSriPaymentCode(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                {SRI_PAYMENT_CODES.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Sustento tributario {taxSupportCode && <span className="text-blue-600">(sugerido)</span>}
              </label>
              <select value={taxSupportCode} onChange={(e) => setTaxSupportCode(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">— Seleccionar —</option>
                {filteredTaxSupport.map((ts) => (
                  <option key={ts.code} value={ts.code}>{ts.code} — {ts.description}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Costo</label>
              <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">— Sin asignar —</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>{cc.code} · {cc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Proyecto</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">— Sin asignar —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Retención</label>
              <div className="flex items-center gap-3 mt-1">
                <button type="button" onClick={() => setWithholding(false)} className={`px-3 py-1.5 text-sm rounded-md border ${!withholding ? "bg-[#1769E0] text-white border-[#1769E0]" : "bg-white"}`}>No</button>
                <button type="button" onClick={() => setWithholding(true)} className={`px-3 py-1.5 text-sm rounded-md border ${withholding ? "bg-[#1769E0] text-white border-[#1769E0]" : "bg-white"}`}>Sí</button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proveedor */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium text-[#1769E0]">Proveedor</h3>
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground">Buscar proveedor</label>
            <Input
              value={supplierSearch}
              onChange={(e) => searchSupplier(e.target.value)}
              placeholder="RUC, cédula, nombre, email..."
              onFocus={() => supplierResults.length > 0 && setShowSupplierDropdown(true)}
              onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
            />
            {showSupplierDropdown && supplierResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                {supplierResults.map((s) => (
                  <button key={s.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onMouseDown={() => selectSupplier(s)}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground ml-2">{s.identification}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {supplierName && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <div><span className="text-muted-foreground">Nombre:</span> {supplierName}</div>
              <div><span className="text-muted-foreground">RUC/Cédula:</span> {supplierIdentification}</div>
              {supplierPhone && <div><span className="text-muted-foreground">Teléfono:</span> {supplierPhone}</div>}
              {supplierAddress && <div><span className="text-muted-foreground">Dirección:</span> {supplierAddress}</div>}
              {supplierEmail && <div><span className="text-muted-foreground">Email:</span> {supplierEmail}</div>}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => window.open("/facturacion/suppliers", "_blank")}>+ Nuevo proveedor</Button>
        </CardContent>
      </Card>

      {/* Observación */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Observación</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px] resize-y" placeholder="Notas adicionales..." />
        </CardContent>
      </Card>

      {/* Detalle compra */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[#1769E0]">Detalle de compra</h3>
            <div className="flex gap-2">
              <span className="text-xs text-muted-foreground">F2: buscar producto</span>
              <Button variant="outline" size="sm" onClick={addItem}>+ Agregar línea</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 px-1">Cód. XML</th>
                  <th className="py-2 px-1">Descripción</th>
                  <th className="py-2 px-1 w-20">Cantidad</th>
                  <th className="py-2 px-1 w-24">P. Unit.</th>
                  <th className="py-2 px-1 w-16">IVA</th>
                  <th className="py-2 px-1 w-16">Desc %</th>
                  <th className="py-2 px-1 w-20">Desc $</th>
                  <th className="py-2 px-1 w-24">Total neto</th>
                  {purchaseType === "MERCHANDISE" && <th className="py-2 px-1 w-28">Bodega</th>}
                  <th className="py-2 px-1 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const sub = computeItemSubtotal(item);
                  return (
                    <tr key={i} className="border-b">
                      <td className="py-1 px-1">
                        <Input value={item.xmlProductCode} onChange={(e) => updateItem(i, "xmlProductCode", e.target.value)} className="text-xs font-mono w-20" placeholder="—" readOnly={!!item.xmlProductCode} />
                      </td>
                      <td className="py-1 px-1">
                        <Input id={`product-search-${i}`} value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} className="text-sm" placeholder="Buscar producto o servicio" />
                      </td>
                      <td className="py-1 px-1"><Input type="number" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="text-sm" step="any" /></td>
                      <td className="py-1 px-1"><Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} className="text-sm" step="any" /></td>
                      <td className="py-1 px-1">
                        <select value={item.taxRate} onChange={(e) => updateItem(i, "taxRate", e.target.value)} className="w-full rounded-md border px-1 py-1.5 text-xs">
                          <option value="15">15%</option>
                          <option value="5">5%</option>
                          <option value="0">0%</option>
                        </select>
                      </td>
                      <td className="py-1 px-1"><Input type="number" value={item.discountPct} onChange={(e) => updateItem(i, "discountPct", e.target.value)} className="text-xs" step="any" /></td>
                      <td className="py-1 px-1"><Input type="number" value={item.discountAmount} onChange={(e) => updateItem(i, "discountAmount", e.target.value)} className="text-xs" step="any" /></td>
                      <td className="py-1 px-1 text-right font-mono">${sub.toFixed(2)}</td>
                      {purchaseType === "MERCHANDISE" && (
                        <td className="py-1 px-1">
                          <select value={item.warehouseId} onChange={(e) => updateItem(i, "warehouseId", e.target.value)} className="w-full rounded-md border px-1 py-1.5 text-xs">
                            <option value="">—</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </td>
                      )}
                      <td className="py-1 px-1">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(i)} disabled={items.length <= 1} className="h-7 w-7 p-0">✕</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {items.some((it) => it.xmlProductCode && !it.productId) && (
            <p className="text-xs text-amber-600">Algunos productos del XML no están vinculados al catálogo.</p>
          )}
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-medium text-[#1769E0] mb-3">Totales</h3>
          <div className="space-y-1 text-sm max-w-md ml-auto">
            <div className="flex justify-between"><span>Subtotal dif 0%</span><span className="font-mono">${subtotalDif0.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Subtotal 0%</span><span className="font-mono">${subtotal0.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>No Objeto de Impuesto</span><span className="font-mono">$0.00</span></div>
            <div className="flex justify-between"><span>Exento de IVA</span><span className="font-mono">$0.00</span></div>
            <div className="flex justify-between border-t pt-1"><span className="font-medium">Subtotal</span><span className="font-mono">${(subtotalDif0 + subtotal0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Descuento</span><span className="font-mono">${discountTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>IVA</span><span className="font-mono">${ivaTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Propina</span><span className="font-mono">${tip.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-1 text-lg font-semibold"><span>Total Factura</span><span className="font-mono">${totalFactura.toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => router.push("/facturacion/purchases/documents")}>Cancelar</Button>
        <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>Guardar borrador</Button>
        <Button onClick={() => handleSave(false)} disabled={saving} className="bg-[#1769E0] hover:bg-[#1E52F1]">
          {saving ? "Guardando..." : "Registrar compra"}
        </Button>
        {withholding && (
          <Button variant="outline" className="text-[#F59E0B] border-[#F59E0B]" disabled>Crear retención (después de registrar)</Button>
        )}
      </div>
    </div>
  );
}
