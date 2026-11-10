"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Transfer = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  sourceWarehouse: { id: string; code: string; name: string };
  destinationWarehouse: { id: string; code: string; name: string };
  items: Array<{ productId: string; quantity: string; product: { name: string } }>;
};

type Warehouse = { id: string; name: string };
type Product = { id: string; name: string; primaryCode: string | null; stock: number };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  PENDING: { label: "Pendiente", className: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Completada", className: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "Cancelada", className: "bg-red-50 text-red-700" },
};

type TransferItem = { productId: string; quantity: string };

export function TransfersClient({
  initialTransfers,
  initialTotal,
  warehouses,
  products,
}: {
  initialTransfers: Transfer[];
  initialTotal: number;
  warehouses: Warehouse[];
  products: Product[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [items, setItems] = useState<TransferItem[]>([{ productId: "", quantity: "" }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [productSearch, setProductSearch] = useState("");

  function addItem() {
    setItems([...items, { productId: "", quantity: "" }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof TransferItem, value: string) {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  async function submit() {
    setError("");
    if (!sourceWarehouseId || !destinationWarehouseId) {
      setError("Selecciona bodegas de origen y destino.");
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      setError("La bodega origen y destino no pueden ser la misma.");
      return;
    }
    const validItems = items.filter((i) => i.productId && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setError("Agrega al menos un producto con cantidad.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/inventory/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceWarehouseId,
        destinationWarehouseId,
        items: validItems.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        notes: notes || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Error al crear transferencia.");
      return;
    }
    setShowForm(false);
    setItems([{ productId: "", quantity: "" }]);
    setNotes("");
    router.refresh();
  }

  async function completeTransfer(id: string) {
    const res = await fetch(`/api/inventory/transfers/${id}/complete`, { method: "POST" });
    if (res.ok) router.refresh();
  }

  const filteredProducts = productSearch
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.primaryCode?.toLowerCase().includes(productSearch.toLowerCase()))
    : products;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#667085]">{initialTotal} transferencia(s)</p>
        <Button
          size="sm"
          className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancelar" : "+ Nueva transferencia"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-[#1E52F1]/20 bg-[#1E52F1]/[0.02]">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-[#172033]">Nueva transferencia entre bodegas</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Bodega origen</label>
                <select
                  value={sourceWarehouseId}
                  onChange={(e) => setSourceWarehouseId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
                >
                  <option value="">Seleccionar</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Bodega destino</label>
                <select
                  value={destinationWarehouseId}
                  onChange={(e) => setDestinationWarehouseId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
                >
                  <option value="">Seleccionar</option>
                  {warehouses.filter((w) => w.id !== sourceWarehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#667085]">Productos</label>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, "productId", e.target.value)}
                      className="h-8 flex-1 rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
                    >
                      <option value="">Seleccionar producto</option>
                      {filteredProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.primaryCode ? `(${p.primaryCode})` : ""} — Stock: {p.stock}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      placeholder="Cantidad"
                      className="h-8 w-28"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={items.length <= 1}
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" variant="ghost" className="mt-2 text-[#1E52F1]" onClick={addItem}>
                <Plus className="size-4 mr-1" /> Agregar producto
              </Button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#667085]">Notas (opcional)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas de la transferencia" />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={submit} disabled={loading} className="bg-[#1E52F1] text-white hover:bg-[#1745CE]">
                {loading ? "Creando..." : "Crear transferencia"}
              </Button>
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-[#E4E9F0]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E9F0] bg-[#F8F9FB]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Número</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Origen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Destino</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">Productos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Fecha</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {initialTransfers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#667085]">No hay transferencias.</td></tr>
              ) : initialTransfers.map((t) => {
                const status = STATUS_LABELS[t.status] ?? { label: t.status, className: "bg-slate-100" };
                return (
                  <tr key={t.id} className="border-b border-[#E4E9F0] last:border-0 hover:bg-[#F8F9FB] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs">{t.number}</td>
                    <td className="px-4 py-2.5">{t.sourceWarehouse.name}</td>
                    <td className="px-4 py-2.5">{t.destinationWarehouse.name}</td>
                    <td className="px-4 py-2.5 text-center">{t.items.length}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{new Date(t.createdAt).toLocaleDateString("es-EC")}</td>
                    <td className="px-4 py-2.5 text-center">
                      {(t.status === "DRAFT" || t.status === "PENDING") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => completeTransfer(t.id)}
                        >
                          Completar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-[#E4E9F0] px-4 py-2 text-xs text-[#667085]">
            {initialTotal} transferencia(s)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
