"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SettlementItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  subtotal: string;
  ivaRate: string;
  ivaAmount: string;
};

type PaymentRow = { formaPago: string; total: string; plazo: string; unidadTiempo: string };
type AdditionalDetail = { name: string; value: string };

type Supplier = { id: string; name: string; identification: string; address?: string | null };

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

function parseNum(v: string): number { const n = Number(v); return isNaN(n) ? 0 : n; }

function calcItem(item: SettlementItem): SettlementItem {
  const qty = parseNum(item.quantity);
  const price = parseNum(item.unitPrice);
  const disc = parseNum(item.discount);
  const sub = qty * price - disc;
  const iva = sub * (parseNum(item.ivaRate) / 100);
  return { ...item, subtotal: sub.toFixed(2), ivaAmount: iva.toFixed(2) };
}

const EMPTY_ITEM: SettlementItem = {
  description: "", quantity: "1", unitPrice: "0", discount: "0", subtotal: "0", ivaRate: "15", ivaAmount: "0",
};

export function NewSettlementClient() {
  const router = useRouter();

  const [supplierName, setSupplierName] = useState("");
  const [supplierRuc, setSupplierRuc] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [docEstab, setDocEstab] = useState("001");
  const [docPoint, setDocPoint] = useState("001");
  const [docSeq, setDocSeq] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [taxSupportCode, setTaxSupportCode] = useState("");

  const [activeTab, setActiveTab] = useState<"details" | "reimbursement">("details");
  const [items, setItems] = useState<SettlementItem[]>([{ ...EMPTY_ITEM }]);
  const [payments, setPayments] = useState<PaymentRow[]>([{ formaPago: "20", total: "0", plazo: "0", unidadTiempo: "dias" }]);
  const [additionalDetails, setAdditionalDetails] = useState<AdditionalDetail[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    setSupplierName(s.name);
    setSupplierRuc(s.identification);
    setSupplierAddress(s.address ?? "");
    setSupplierSearch(s.name);
    setShowSupplierDropdown(false);
  }

  function addItem() { setItems([...items, { ...EMPTY_ITEM }]); }

  function updateItem(index: number, field: keyof SettlementItem, value: string) {
    const next = [...items];
    next[index] = calcItem({ ...next[index]!, [field]: value });
    setItems(next);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotalSinImpuestos = items.reduce((s, it) => s + parseNum(it.subtotal), 0);
  const sub0 = items.filter((it) => parseNum(it.ivaRate) === 0).reduce((s, it) => s + parseNum(it.subtotal), 0);
  const sub5 = items.filter((it) => parseNum(it.ivaRate) === 5).reduce((s, it) => s + parseNum(it.subtotal), 0);
  const sub8 = items.filter((it) => parseNum(it.ivaRate) === 8).reduce((s, it) => s + parseNum(it.subtotal), 0);
  const sub15 = items.filter((it) => parseNum(it.ivaRate) === 15).reduce((s, it) => s + parseNum(it.subtotal), 0);
  const iva5 = items.filter((it) => parseNum(it.ivaRate) === 5).reduce((s, it) => s + parseNum(it.ivaAmount), 0);
  const iva8 = items.filter((it) => parseNum(it.ivaRate) === 8).reduce((s, it) => s + parseNum(it.ivaAmount), 0);
  const iva15 = items.filter((it) => parseNum(it.ivaRate) === 15).reduce((s, it) => s + parseNum(it.ivaAmount), 0);
  const discountTotal = items.reduce((s, it) => s + parseNum(it.discount), 0);
  const totalIva = iva5 + iva8 + iva15;
  const grandTotal = subtotalSinImpuestos + totalIva;

  useEffect(() => {
    if (payments.length > 0) {
      const n = [...payments];
      n[0] = { ...n[0]!, total: grandTotal.toFixed(2) };
      setPayments(n);
    }
  }, [grandTotal]);

  async function handleSubmit(asDraft: boolean) {
    if (!supplierName.trim() || !supplierRuc.trim()) {
      setError("Nombre y RUC/CI del proveedor son obligatorios.");
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      setError("Todos los ítems deben tener descripción.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/purchases/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName,
          supplierRuc,
          supplierAddress,
          docEstab,
          docPoint,
          docSeq,
          issueDate,
          taxSupportCode: taxSupportCode || undefined,
          asDraft,
          items: items.map((it) => ({
            description: it.description,
            quantity: parseNum(it.quantity),
            unitPrice: parseNum(it.unitPrice),
            discount: parseNum(it.discount),
            subtotal: parseNum(it.subtotal),
            ivaRate: parseNum(it.ivaRate),
            ivaAmount: parseNum(it.ivaAmount),
          })),
          payments: payments.map((p) => ({
            formaPago: p.formaPago,
            total: parseNum(p.total),
            plazo: parseNum(p.plazo),
            unidadTiempo: p.unidadTiempo,
          })),
          additionalDetails: additionalDetails.length > 0 ? additionalDetails : undefined,
          subtotal: subtotalSinImpuestos,
          totalIva,
          grandTotal,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error al crear liquidación.");
      router.push("/facturacion/purchases/settlements");
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
        const el = document.getElementById("settlement-search-0");
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
          <h1 className="text-2xl font-semibold tracking-tight">LIQUIDACIÓN DE COMPRA</h1>
          <p className="text-sm text-muted-foreground">Emitir liquidación de compra electrónica</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/facturacion/purchases/settlements")}>Volver</Button>
        </div>
      </div>

      {/* Proveedor + cabecera */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-medium text-[#1769E0]">Proveedor</h3>
              <div className="relative">
                <label className="text-xs font-medium text-muted-foreground">Buscar proveedor</label>
                <Input
                  value={supplierSearch}
                  onChange={(e) => searchSupplier(e.target.value)}
                  placeholder="RUC, cédula, nombre..."
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">RUC / Cédula</label>
                  <Input value={supplierRuc} onChange={(e) => setSupplierRuc(e.target.value)} className="font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Razón social</label>
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dirección</label>
                <Input value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-[#1769E0]">Documento</h3>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Doc. #</label>
                <div className="flex gap-1">
                  <Input value={docEstab} onChange={(e) => setDocEstab(e.target.value)} className="w-16 text-center font-mono text-xs" maxLength={3} />
                  <Input value={docPoint} onChange={(e) => setDocPoint(e.target.value)} className="w-16 text-center font-mono text-xs" maxLength={3} />
                  <Input value={docSeq} onChange={(e) => setDocSeq(e.target.value)} className="flex-1 font-mono text-xs" maxLength={9} placeholder="Secuencial" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">F. Emisión</label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tip. Sus. tributario</label>
                <select value={taxSupportCode} onChange={(e) => setTaxSupportCode(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">— Seleccionar —</option>
                  <option value="05">05 — Liquidación gastos viaje, hospedaje</option>
                  <option value="08">08 — Valor pagado para reembolso de gasto</option>
                  <option value="10">10 — Distribución de dividendos</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button type="button" onClick={() => setActiveTab("details")} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === "details" ? "border-[#1769E0] text-[#1769E0]" : "border-transparent text-muted-foreground"}`}>
          Detalles de la compra
        </button>
        <button type="button" onClick={() => setActiveTab("reimbursement")} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === "reimbursement" ? "border-[#1769E0] text-[#1769E0]" : "border-transparent text-muted-foreground"}`}>
          Detalles de reembolso
        </button>
      </div>

      {activeTab === "details" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[#1769E0]">Detalle</h3>
                <span className="text-xs text-muted-foreground">F2: búsqueda rápida</span>
              </div>
              <Button variant="outline" size="sm" onClick={addItem}>Buscar producto o servicio</Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-7 items-end">
                <div className="sm:col-span-2">
                  <Input id={`settlement-search-${i}`} placeholder="Descripción" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                </div>
                <Input type="number" placeholder="Cant." value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} step="any" />
                <Input type="number" placeholder="P. Unit." value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} step="any" />
                <Input type="number" placeholder="Desc." value={item.discount} onChange={(e) => updateItem(i, "discount", e.target.value)} step="any" />
                <select value={item.ivaRate} onChange={(e) => updateItem(i, "ivaRate", e.target.value)} className="rounded-md border px-2 py-1.5 text-sm">
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="8">8%</option>
                  <option value="15">15%</option>
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono">${parseNum(item.subtotal).toFixed(2)}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(i)} disabled={items.length <= 1} className="h-7 w-7 p-0">✕</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "reimbursement" && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Los detalles de reembolso se habilitan cuando el sustento tributario corresponde (código 08).</p>
          </CardContent>
        </Card>
      )}

      {/* Formas de pago */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[#1769E0]">Formas de pago</h3>
            <Button variant="outline" size="sm" onClick={() => setPayments([...payments, { formaPago: "20", total: "0", plazo: "0", unidadTiempo: "dias" }])}>+ Agregar nuevo</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">Forma pago</th>
                <th className="py-2 w-24">Total</th>
                <th className="py-2 w-20">Plazo</th>
                <th className="py-2 w-24">U. Tiempo</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1">
                    <select value={p.formaPago} onChange={(e) => { const n = [...payments]; n[i] = { ...n[i]!, formaPago: e.target.value }; setPayments(n); }} className="w-full rounded-md border px-2 py-1.5 text-xs">
                      {SRI_PAYMENT_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1"><Input type="number" value={p.total} onChange={(e) => { const n = [...payments]; n[i] = { ...n[i]!, total: e.target.value }; setPayments(n); }} className="text-sm" step="any" /></td>
                  <td className="py-1"><Input type="number" value={p.plazo} onChange={(e) => { const n = [...payments]; n[i] = { ...n[i]!, plazo: e.target.value }; setPayments(n); }} className="text-sm" /></td>
                  <td className="py-1">
                    <select value={p.unidadTiempo} onChange={(e) => { const n = [...payments]; n[i] = { ...n[i]!, unidadTiempo: e.target.value }; setPayments(n); }} className="w-full rounded-md border px-2 py-1.5 text-xs">
                      <option value="dias">Días</option>
                      <option value="meses">Meses</option>
                    </select>
                  </td>
                  <td className="py-1"><Button variant="ghost" size="sm" onClick={() => setPayments(payments.filter((_, j) => j !== i))} className="h-7 w-7 p-0">✕</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detalles adicionales */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[#1769E0]">Detalles adicionales</h3>
            <Button variant="outline" size="sm" onClick={() => setAdditionalDetails([...additionalDetails, { name: "", value: "" }])}>+ Agregar</Button>
          </div>
          {additionalDetails.map((d, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3 items-end">
              <Input value={d.name} onChange={(e) => { const n = [...additionalDetails]; n[i] = { ...n[i]!, name: e.target.value }; setAdditionalDetails(n); }} placeholder="Nombre" />
              <Input value={d.value} onChange={(e) => { const n = [...additionalDetails]; n[i] = { ...n[i]!, value: e.target.value }; setAdditionalDetails(n); }} placeholder="Valor" />
              <Button variant="ghost" size="sm" onClick={() => setAdditionalDetails(additionalDetails.filter((_, j) => j !== i))} className="h-8 w-8 p-0">✕</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-medium text-[#1769E0] mb-3">Totales</h3>
          <div className="space-y-1 text-sm max-w-md ml-auto">
            <div className="flex justify-between"><span>Subtotal sin impuestos</span><span className="font-mono">${subtotalSinImpuestos.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Subtotal tarifa especial 8%</span><span className="font-mono">${sub8.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Subtotal 0%</span><span className="font-mono">${sub0.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Subtotal 5%</span><span className="font-mono">${sub5.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Subtotal 15%</span><span className="font-mono">${sub15.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Subtotal no objeto de IVA</span><span className="font-mono">$0.00</span></div>
            <div className="flex justify-between"><span>Subtotal exento de IVA</span><span className="font-mono">$0.00</span></div>
            <div className="flex justify-between"><span>Total descuento</span><span className="font-mono">${discountTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>ICE</span><span className="font-mono">$0.00</span></div>
            <div className="flex justify-between"><span>IVA tarifa especial 8%</span><span className="font-mono">${iva8.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>IVA 5%</span><span className="font-mono">${iva5.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>IVA 15%</span><span className="font-mono">${iva15.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-1"><span className="font-medium">Valor total</span><span className="font-mono">${grandTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-lg font-semibold border-t pt-1"><span>Total compra</span><span className="font-mono text-[#1769E0]">${grandTotal.toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => router.push("/facturacion/purchases/settlements")}>Cancelar</Button>
        <Button variant="outline" onClick={() => {}} disabled>Vista previa</Button>
        <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>Guardar borrador</Button>
        <Button onClick={() => handleSubmit(false)} disabled={saving} className="bg-[#1769E0] hover:bg-[#1E52F1]">
          {saving ? "Guardando..." : "Emitir liquidación"}
        </Button>
      </div>
    </div>
  );
}
