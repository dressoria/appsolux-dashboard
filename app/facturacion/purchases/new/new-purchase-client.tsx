"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ItemRow = {
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
};

export function NewPurchaseClient() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierIdentification, setSupplierIdentification] = useState("");
  const [documentType, setDocumentType] = useState("INVOICE");
  const [supplierDocumentNumber, setSupplierDocumentNumber] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [items, setItems] = useState<ItemRow[]>([{ description: "", quantity: "1", unitPrice: "0", discountAmount: "0", taxRate: "15" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addItem() {
    setItems([...items, { description: "", quantity: "1", unitPrice: "0", discountAmount: "0", taxRate: "15" }]);
  }

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    const next = [...items];
    next[index] = { ...next[index]!, [field]: value };
    setItems(next);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.quantity) * Number(item.unitPrice) - Number(item.discountAmount);
  }, 0);
  const ivaTotal = items.reduce((sum, item) => {
    const sub = Number(item.quantity) * Number(item.unitPrice) - Number(item.discountAmount);
    return sum + sub * (Number(item.taxRate) / 100);
  }, 0);
  const total = subtotal + ivaTotal;

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/purchases/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          supplierName: supplierName || undefined,
          supplierIdentification: supplierIdentification || undefined,
          documentType,
          supplierDocumentNumber: supplierDocumentNumber || undefined,
          accessKey: accessKey || undefined,
          issueDate: issueDate ? new Date(issueDate).toISOString() : undefined,
          subtotal15: subtotal,
          ivaTotal,
          total,
          paymentMethod,
          items: items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discountAmount: Number(item.discountAmount),
            taxRate: Number(item.taxRate),
          })),
          payments: [{ method: paymentMethod, amount: total }],
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error al crear.");
      router.push("/facturacion/purchases/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registrar compra</h1>
        <p className="text-sm text-muted-foreground">Registra un documento de compra recibido</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Proveedor</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nombre del proveedor" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            <Input placeholder="RUC / Cédula" value={supplierIdentification} onChange={(e) => setSupplierIdentification(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Documento</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
              <option value="INVOICE">Factura</option>
              <option value="CREDIT_NOTE">Nota de crédito</option>
              <option value="DEBIT_NOTE">Nota de débito</option>
              <option value="OTHER">Otro</option>
            </select>
            <Input placeholder="Nº documento" value={supplierDocumentNumber} onChange={(e) => setSupplierDocumentNumber(e.target.value)} />
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <Input placeholder="Clave de acceso (opcional)" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} className="font-mono text-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Ítems</h3>
            <Button variant="outline" size="sm" onClick={addItem}>+ Agregar línea</Button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-6 items-end">
              <div className="sm:col-span-2">
                <Input placeholder="Descripción" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
              </div>
              <Input type="number" placeholder="Cantidad" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
              <Input type="number" placeholder="Precio" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} />
              <select value={item.taxRate} onChange={(e) => updateItem(i, "taxRate", e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                <option value="15">IVA 15%</option>
                <option value="0">IVA 0%</option>
                <option value="5">IVA 5%</option>
              </select>
              <Button variant="ghost" size="sm" onClick={() => removeItem(i)} disabled={items.length <= 1}>✕</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span>IVA:</span><span>${ivaTotal.toFixed(2)}</span></div>
          <div className="flex justify-between font-medium text-lg"><span>Total:</span><span>${total.toFixed(2)}</span></div>
          <div className="pt-2">
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="credit">Crédito</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => router.push("/facturacion/purchases/documents")}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>{saving ? "Guardando..." : "Registrar compra"}</Button>
      </div>
    </div>
  );
}
