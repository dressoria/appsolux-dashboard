"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  warehouses: Array<{ id: string; code: string; name: string }>;
};

export function AdjustmentsClient({ warehouses }: Props) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT">("ADJUSTMENT_IN");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!warehouseId || !productId || !quantity) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId, productId, quantity: Number(quantity), type, reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Error al crear ajuste");
        return;
      }
      setProductId("");
      setQuantity("");
      setReason("");
      alert("Ajuste creado correctamente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Bodega</label>
            <select className="w-full mt-1 rounded-md border px-3 py-2 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select className="w-full mt-1 rounded-md border px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="ADJUSTMENT_IN">Incremento</option>
              <option value="ADJUSTMENT_OUT">Disminución</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">ID del producto</label>
          <Input value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1" placeholder="ID del producto" />
        </div>
        <div>
          <label className="text-sm font-medium">Cantidad</label>
          <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Motivo</label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
        </div>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Guardando..." : "Crear ajuste"}
        </Button>
      </CardContent>
    </Card>
  );
}
