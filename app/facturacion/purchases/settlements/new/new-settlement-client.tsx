"use client";

import { useState } from "react";
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

function calcItem(item: SettlementItem): SettlementItem {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const disc = Number(item.discount) || 0;
  const sub = qty * price - disc;
  const iva = sub * (Number(item.ivaRate) / 100);
  return { ...item, subtotal: sub.toFixed(2), ivaAmount: iva.toFixed(2) };
}

const EMPTY_ITEM: SettlementItem = {
  description: "",
  quantity: "1",
  unitPrice: "0",
  discount: "0",
  subtotal: "0",
  ivaRate: "15",
  ivaAmount: "0",
};

export function NewSettlementClient() {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState("");
  const [supplierRuc, setSupplierRuc] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [items, setItems] = useState<SettlementItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addItem() {
    setItems([...items, { ...EMPTY_ITEM }]);
  }

  function updateItem(index: number, field: keyof SettlementItem, value: string) {
    const next = [...items];
    next[index] = calcItem({ ...next[index]!, [field]: value });
    setItems(next);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((s, it) => s + Number(it.subtotal), 0);
  const totalIva = items.reduce((s, it) => s + Number(it.ivaAmount), 0);
  const grandTotal = subtotal + totalIva;

  async function handleSubmit() {
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
          items: items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            discount: Number(it.discount),
            subtotal: Number(it.subtotal),
            ivaRate: Number(it.ivaRate),
            ivaAmount: Number(it.ivaAmount),
          })),
          subtotal,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva liquidación de compra</h1>
        <p className="text-sm text-muted-foreground">
          Emitir liquidación de compra electrónica vía SRI
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Datos del proveedor</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nombre del proveedor"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
            <Input
              placeholder="RUC / CI"
              value={supplierRuc}
              onChange={(e) => setSupplierRuc(e.target.value)}
              className="font-mono"
            />
          </div>
          <Input
            placeholder="Dirección (opcional)"
            value={supplierAddress}
            onChange={(e) => setSupplierAddress(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Detalle</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              + Agregar ítem
            </Button>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-7 items-end">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Descripción"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                />
              </div>
              <Input
                type="number"
                placeholder="Cant."
                value={item.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
              />
              <Input
                type="number"
                placeholder="P. Unit."
                value={item.unitPrice}
                onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
              />
              <select
                value={item.ivaRate}
                onChange={(e) => updateItem(i, "ivaRate", e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="15">15%</option>
              </select>
              <div className="text-sm font-medium py-2">${Number(item.subtotal).toFixed(2)}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(i)}
                disabled={items.length <= 1}
              >
                ✕
              </Button>
            </div>
          ))}
          <div className="flex flex-col items-end gap-1 text-sm">
            <div>Subtotal: ${subtotal.toFixed(2)}</div>
            <div>IVA: ${totalIva.toFixed(2)}</div>
            <div className="font-semibold text-base">Total: ${grandTotal.toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => router.push("/facturacion/purchases/settlements")}
        >
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Guardando..." : "Guardar borrador"}
        </Button>
      </div>
    </div>
  );
}
