"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type WithholdingLine = {
  taxType: "RENTA" | "IVA";
  code: string;
  description: string;
  taxBase: string;
  percentage: string;
  retainedAmount: string;
};

type PaymentRow = { formaPago: string; total: string };
type AdditionalDetail = { name: string; value: string };

type WithholdingCode = {
  id: string;
  taxType: string;
  code: string;
  description: string;
  percentage: string;
  validFrom: string;
  validTo: string | null;
};

type SupportDoc = {
  id: string;
  supplierDocumentNumber: string | null;
  supplierName: string | null;
  supplierIdentification: string | null;
  accessKey: string | null;
  issueDate: string | null;
  total: string;
  documentType: string;
  taxSupportCode: string | null;
  sriPaymentCode: string | null;
  subtotal0: string;
  subtotal15: string;
  ivaTotal: string;
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

const DOC_TYPE_CODES: Record<string, string> = {
  INVOICE: "01",
  CREDIT_NOTE: "04",
  DEBIT_NOTE: "05",
  PURCHASE_SETTLEMENT: "03",
};

function parseNum(v: string): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function NewWithholdingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseIdFromUrl = searchParams.get("purchaseDocumentId") ?? "";

  const [schemaVersion, setSchemaVersion] = useState<"1.0" | "2.0">("2.0");

  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierIdentification, setSupplierIdentification] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [fiscalPeriod, setFiscalPeriod] = useState(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  });
  const [relatedParty, setRelatedParty] = useState(false);

  const [purchaseDocumentId, setPurchaseDocumentId] = useState(purchaseIdFromUrl);
  const [supportDocSearch, setSupportDocSearch] = useState("");
  const [supportDocResults, setSupportDocResults] = useState<SupportDoc[]>([]);
  const [showSupportDocDropdown, setShowSupportDocDropdown] = useState(false);
  const [selectedSupportDoc, setSelectedSupportDoc] = useState<SupportDoc | null>(null);
  const [codSustento, setCodSustento] = useState("");

  const [supportTaxes, setSupportTaxes] = useState<Array<{ codImpuesto: string; codigoPorcentaje: string; base: string; tarifa: string; valor: string }>>([]);
  const [withholdingCodes, setWithholdingCodes] = useState<WithholdingCode[]>([]);
  const [lines, setLines] = useState<WithholdingLine[]>([
    { taxType: "RENTA", code: "", description: "", taxBase: "0", percentage: "0", retainedAmount: "0" },
  ]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [additionalDetails, setAdditionalDetails] = useState<AdditionalDetail[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/purchases/withholding-codes").then((r) => r.json()).then((d) => {
      setWithholdingCodes((d.codes ?? d ?? []) as WithholdingCode[]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (purchaseIdFromUrl) {
      loadSupportDoc(purchaseIdFromUrl);
    }
  }, [purchaseIdFromUrl]);

  async function loadSupportDoc(id: string) {
    try {
      const res = await fetch(`/api/purchases/documents/${id}`);
      const data = await res.json();
      const doc = data.document ?? data;
      if (doc) {
        setSelectedSupportDoc(doc);
        setPurchaseDocumentId(doc.id);
        setSupplierName(doc.supplierName ?? doc.supplier?.name ?? "");
        setSupplierIdentification(doc.supplierIdentification ?? doc.supplier?.identification ?? "");
        setDocNumber(doc.supplierDocumentNumber ?? "");
        if (doc.taxSupportCode) setCodSustento(doc.taxSupportCode);
        if (doc.issueDate) {
          const d = new Date(doc.issueDate);
          setFiscalPeriod(`${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
        }

        const taxes: typeof supportTaxes = [];
        const base15 = parseNum(doc.subtotal15);
        const base0 = parseNum(doc.subtotal0);
        const iva = parseNum(doc.ivaTotal);
        if (base15 > 0) taxes.push({ codImpuesto: "2", codigoPorcentaje: "4", base: String(base15), tarifa: "15", valor: String(iva) });
        if (base0 > 0) taxes.push({ codImpuesto: "2", codigoPorcentaje: "0", base: String(base0), tarifa: "0", valor: "0" });
        setSupportTaxes(taxes);

        if (doc.sriPaymentCode) {
          setPayments([{ formaPago: doc.sriPaymentCode, total: doc.total }]);
        }
      }
    } catch {}
  }

  const searchSupportDoc = useCallback(async (q: string) => {
    setSupportDocSearch(q);
    if (q.length < 2) { setShowSupportDocDropdown(false); return; }
    try {
      const res = await fetch(`/api/purchases/documents?q=${encodeURIComponent(q)}&pageSize=10`);
      const data = await res.json();
      setSupportDocResults(data.items ?? []);
      setShowSupportDocDropdown(true);
    } catch { setShowSupportDocDropdown(false); }
  }, []);

  function selectSupportDoc(doc: SupportDoc) {
    setShowSupportDocDropdown(false);
    setSupportDocSearch(doc.supplierDocumentNumber ?? doc.supplierName ?? "");
    loadSupportDoc(doc.id);
  }

  function addLine() {
    setLines([...lines, { taxType: "RENTA", code: "", description: "", taxBase: "0", percentage: "0", retainedAmount: "0" }]);
  }

  function updateLine(index: number, field: keyof WithholdingLine, value: string) {
    const next = [...lines];
    const line = { ...next[index]!, [field]: value };
    if (field === "code") {
      const wc = withholdingCodes.find((c) => c.code === value && c.taxType === line.taxType);
      if (wc) {
        line.description = wc.description;
        line.percentage = wc.percentage;
        line.retainedAmount = (parseNum(line.taxBase) * parseNum(wc.percentage) / 100).toFixed(2);
      }
    }
    if (field === "taxBase" || field === "percentage") {
      line.retainedAmount = (parseNum(line.taxBase) * parseNum(line.percentage) / 100).toFixed(2);
    }
    next[index] = line;
    setLines(next);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  const totalRetained = lines.reduce((sum, l) => sum + parseNum(l.retainedAmount), 0);

  function filteredCodes(taxType: string) {
    const dateStr = issueDate;
    return withholdingCodes.filter((c) => {
      if (c.taxType !== taxType) return false;
      if (dateStr && c.validFrom && new Date(dateStr) < new Date(c.validFrom)) return false;
      if (dateStr && c.validTo && new Date(dateStr) > new Date(c.validTo)) return false;
      return true;
    });
  }

  async function handleSubmit(asDraft: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/purchases/withholdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseDocumentId: purchaseDocumentId || undefined,
          schemaVersion,
          fiscalPeriod,
          relatedParty,
          codSustento: codSustento || undefined,
          supportTaxes: schemaVersion === "2.0" ? supportTaxes : undefined,
          payments: schemaVersion === "2.0" ? payments : undefined,
          additionalDetails: additionalDetails.length > 0 ? additionalDetails : undefined,
          asDraft,
          lines: lines.map((l) => ({
            taxType: l.taxType,
            code: l.code,
            description: l.description,
            taxBase: parseNum(l.taxBase),
            percentage: parseNum(l.percentage),
            retainedAmount: parseNum(l.retainedAmount),
          })),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error al crear retención.");
      router.push("/facturacion/purchases/withholdings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva retención</h1>
          <p className="text-sm text-muted-foreground">Emitir comprobante de retención electrónico</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/facturacion/purchases/withholdings")}>Volver</Button>
        </div>
      </div>

      {/* Esquema SRI */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-medium text-[#1769E0]">Esquema SRI</h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSchemaVersion("1.0")} className={`px-4 py-2 text-sm rounded-md border ${schemaVersion === "1.0" ? "bg-[#1769E0] text-white border-[#1769E0]" : "bg-white"}`}>Versión 1.0</button>
            <button type="button" onClick={() => setSchemaVersion("2.0")} className={`px-4 py-2 text-sm rounded-md border ${schemaVersion === "2.0" ? "bg-[#1769E0] text-white border-[#1769E0]" : "bg-white"}`}>Versión 2.0</button>
          </div>
        </CardContent>
      </Card>

      {/* Sujeto retenido */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium text-[#1769E0]">SUJETO RETENIDO</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">RUC / Cédula</label>
              <Input value={supplierIdentification} onChange={(e) => setSupplierIdentification(e.target.value)} placeholder="Identificación" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Razón social</label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nombre proveedor" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Doc. #</label>
              <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="001-001-000000001" className="font-mono text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">F. Emisión</label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">P. Fiscal</label>
              <Input value={fiscalPeriod} onChange={(e) => setFiscalPeriod(e.target.value)} placeholder="MM/AAAA" className="font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Parte relacionada</label>
              <div className="flex items-center gap-3 mt-1">
                <button type="button" onClick={() => setRelatedParty(false)} className={`px-3 py-1.5 text-sm rounded-md border ${!relatedParty ? "bg-[#1769E0] text-white border-[#1769E0]" : "bg-white"}`}>NO</button>
                <button type="button" onClick={() => setRelatedParty(true)} className={`px-3 py-1.5 text-sm rounded-md border ${relatedParty ? "bg-[#1769E0] text-white border-[#1769E0]" : "bg-white"}`}>SÍ</button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documento de sustento */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium text-[#1769E0]">DOCUMENTO DE SUSTENTO</h3>
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground">Buscar compra registrada</label>
            <Input
              value={supportDocSearch}
              onChange={(e) => searchSupportDoc(e.target.value)}
              placeholder="Buscar por RUC, documento, proveedor, clave..."
              onFocus={() => supportDocResults.length > 0 && setShowSupportDocDropdown(true)}
              onBlur={() => setTimeout(() => setShowSupportDocDropdown(false), 200)}
            />
            {showSupportDocDropdown && supportDocResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                {supportDocResults.map((d) => (
                  <button key={d.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onMouseDown={() => selectSupportDoc(d)}>
                    <span className="font-mono text-xs">{d.supplierDocumentNumber}</span>
                    <span className="ml-2">{d.supplierName}</span>
                    <span className="ml-2 text-muted-foreground">${parseNum(d.total).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedSupportDoc && (
            <div className="text-sm bg-muted/50 p-3 rounded-md space-y-1">
              <div><span className="text-muted-foreground">Doc:</span> {selectedSupportDoc.supplierDocumentNumber}</div>
              <div><span className="text-muted-foreground">Proveedor:</span> {selectedSupportDoc.supplierName} ({selectedSupportDoc.supplierIdentification})</div>
              <div><span className="text-muted-foreground">Total:</span> ${parseNum(selectedSupportDoc.total).toFixed(2)}</div>
            </div>
          )}
          {schemaVersion === "2.0" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cód. Sustento</label>
                <Input value={codSustento} onChange={(e) => setCodSustento(e.target.value)} placeholder="01, 02..." className="font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Pago local/exterior</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="01">
                  <option value="01">Pago local</option>
                  <option value="02">Pago exterior</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impuestos del doc sustento (v2) */}
      {schemaVersion === "2.0" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#1769E0]">IMPUESTOS DEL DOCUMENTO DE SUSTENTO</h3>
              <Button variant="outline" size="sm" onClick={() => setSupportTaxes([...supportTaxes, { codImpuesto: "2", codigoPorcentaje: "4", base: "0", tarifa: "15", valor: "0" }])}>+ Agregar</Button>
            </div>
            {supportTaxes.map((tax, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-6 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <select value={tax.codImpuesto} onChange={(e) => { const n = [...supportTaxes]; n[i] = { ...n[i]!, codImpuesto: e.target.value }; setSupportTaxes(n); }} className="w-full rounded-md border px-2 py-1.5 text-sm">
                    <option value="2">IVA</option>
                    <option value="3">ICE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cód. %</label>
                  <Input value={tax.codigoPorcentaje} onChange={(e) => { const n = [...supportTaxes]; n[i] = { ...n[i]!, codigoPorcentaje: e.target.value }; setSupportTaxes(n); }} className="text-xs font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Base</label>
                  <Input type="number" value={tax.base} onChange={(e) => { const n = [...supportTaxes]; n[i] = { ...n[i]!, base: e.target.value }; setSupportTaxes(n); }} className="text-sm" step="any" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tarifa</label>
                  <Input type="number" value={tax.tarifa} onChange={(e) => { const n = [...supportTaxes]; n[i] = { ...n[i]!, tarifa: e.target.value }; setSupportTaxes(n); }} className="text-sm" step="any" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor</label>
                  <Input type="number" value={tax.valor} onChange={(e) => { const n = [...supportTaxes]; n[i] = { ...n[i]!, valor: e.target.value }; setSupportTaxes(n); }} className="text-sm" step="any" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSupportTaxes(supportTaxes.filter((_, j) => j !== i))} className="h-8 w-8 p-0">✕</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Valores a retener */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[#1769E0]">VALORES A RETENER</h3>
            <Button variant="outline" size="sm" onClick={addLine}>+ Añadir impuesto</Button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-7 items-end">
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select value={line.taxType} onChange={(e) => updateLine(i, "taxType", e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm">
                  <option value="RENTA">RENTA</option>
                  <option value="IVA">IVA</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Código</label>
                <select value={line.code} onChange={(e) => updateLine(i, "code", e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-xs">
                  <option value="">— Seleccionar —</option>
                  {filteredCodes(line.taxType).map((c) => (
                    <option key={c.id} value={c.code}>{c.code} — {c.description} ({c.percentage}%)</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs text-muted-foreground">Descripción</label>
                <Input value={line.description} readOnly className="text-xs bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Base imponible</label>
                <Input type="number" value={line.taxBase} onChange={(e) => updateLine(i, "taxBase", e.target.value)} className="text-sm" step="any" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">%</label>
                <Input type="number" value={line.percentage} onChange={(e) => updateLine(i, "percentage", e.target.value)} className="text-sm" step="any" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor retenido</label>
                <div className="text-sm font-medium py-2 font-mono">${parseNum(line.retainedAmount).toFixed(2)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeLine(i)} disabled={lines.length <= 1} className="h-8 w-8 p-0">✕</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Formas de pago (v2) */}
      {schemaVersion === "2.0" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[#1769E0]">FORMAS DE PAGO</h3>
              <Button variant="outline" size="sm" onClick={() => setPayments([...payments, { formaPago: "20", total: "0" }])}>+ Agregar</Button>
            </div>
            {payments.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Forma pago</label>
                  <select value={p.formaPago} onChange={(e) => { const n = [...payments]; n[i] = { ...n[i]!, formaPago: e.target.value }; setPayments(n); }} className="w-full rounded-md border px-2 py-1.5 text-sm">
                    {SRI_PAYMENT_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Total</label>
                  <Input type="number" value={p.total} onChange={(e) => { const n = [...payments]; n[i] = { ...n[i]!, total: e.target.value }; setPayments(n); }} className="text-sm" step="any" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPayments(payments.filter((_, j) => j !== i))} className="h-8 w-8 p-0">✕</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      {/* Total retenido */}
      <Card>
        <CardContent className="p-5">
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>VALOR TOTAL RETENIDO</span>
            <span className="font-mono text-[#1769E0]">${totalRetained.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => router.push("/facturacion/purchases/withholdings")}>Cancelar</Button>
        <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>Guardar borrador</Button>
        <Button variant="outline" onClick={() => {}} disabled>Vista previa</Button>
        <Button onClick={() => handleSubmit(false)} disabled={saving} className="bg-[#1769E0] hover:bg-[#1E52F1]">
          {saving ? "Guardando..." : "Guardar y enviar al SRI"}
        </Button>
      </div>
    </div>
  );
}
