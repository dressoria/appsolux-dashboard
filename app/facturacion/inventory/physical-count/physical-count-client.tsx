"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PhysicalCount = {
  id: string;
  number: string;
  status: string;
  warehouseId: string;
  warehouse: { id: string; name: string };
  createdAt: string;
  completedAt: string | null;
  items: Array<{
    id: string;
    productId: string;
    product: { name: string; primaryCode: string };
    expectedQuantity: string;
    countedQuantity: string | null;
    difference: string;
  }>;
};

type Warehouse = { id: string; name: string };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "En progreso", className: "bg-blue-50 text-blue-700" },
  COMPLETED: { label: "Completado", className: "bg-emerald-50 text-emerald-700" },
};

export function PhysicalCountClient({
  initialCounts,
  initialTotal,
  warehouses,
}: {
  initialCounts: PhysicalCount[];
  initialTotal: number;
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newWarehouseId, setNewWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState<string | null>(null);

  async function createCount() {
    if (!newWarehouseId) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/inventory/physical-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouseId: newWarehouseId }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Error al crear toma física.");
      return;
    }
    setShowNewForm(false);
    router.refresh();
  }

  async function saveCountItem(countId: string, productId: string) {
    const key = `${countId}:${productId}`;
    const value = countInputs[key];
    if (value === undefined || value === "") return;
    setSavingItem(key);
    await fetch(`/api/inventory/physical-counts/${countId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, countedQuantity: Number(value) }),
    });
    setSavingItem(null);
    router.refresh();
  }

  async function completeCount(countId: string) {
    const res = await fetch(`/api/inventory/physical-counts/${countId}/complete`, {
      method: "POST",
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#667085]">{initialTotal} toma(s) física(s)</p>
        <Button
          size="sm"
          className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"
          onClick={() => setShowNewForm(!showNewForm)}
        >
          {showNewForm ? "Cancelar" : "+ Nueva toma física"}
        </Button>
      </div>

      {showNewForm && (
        <Card className="border-[#1E52F1]/20 bg-[#1E52F1]/[0.02]">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#172033]">Nueva toma física</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Bodega</label>
                <select
                  value={newWarehouseId}
                  onChange={(e) => setNewWarehouseId(e.target.value)}
                  className="h-8 rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
                >
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <Button
                onClick={createCount}
                disabled={creating || !newWarehouseId}
                className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"
              >
                {creating ? "Creando..." : "Crear toma física"}
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Bodega</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">Productos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Fecha</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {initialCounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#667085]">
                    No hay tomas físicas registradas.
                  </td>
                </tr>
              ) : (
                initialCounts.map((c) => {
                  const status = STATUS_LABELS[c.status] ?? { label: c.status, className: "bg-slate-100" };
                  const isExpanded = expandedId === c.id;
                  return (
                    <tr key={c.id} className="border-b border-[#E4E9F0] last:border-0">
                      <td colSpan={6} className="p-0">
                        <div
                          className="grid cursor-pointer grid-cols-[1fr_1fr_80px_100px_1fr_100px] items-center hover:bg-[#F8F9FB] transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        >
                          <span className="px-4 py-2.5 font-mono text-xs">{c.number}</span>
                          <span className="px-4 py-2.5">{c.warehouse.name}</span>
                          <span className="px-4 py-2.5 text-center">{c.items.length}</span>
                          <span className="px-4 py-2.5 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                              {status.label}
                            </span>
                          </span>
                          <span className="px-4 py-2.5 text-xs">{new Date(c.createdAt).toLocaleDateString("es-EC")}</span>
                          <span className="px-4 py-2.5 text-center">
                            {c.status !== "COMPLETED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeCount(c.id);
                                }}
                              >
                                Completar
                              </Button>
                            )}
                          </span>
                        </div>
                        {isExpanded && c.status !== "COMPLETED" && (
                          <div className="border-t border-[#E4E9F0] bg-[#F8F9FB]/50 px-4 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">Conteo de productos</p>
                            <div className="space-y-1.5">
                              {c.items.map((item) => {
                                const key = `${c.id}:${item.productId}`;
                                const inputVal = countInputs[key] ?? (item.countedQuantity ?? "");
                                return (
                                  <div key={item.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="font-medium text-[#172033]">{item.product.name}</span>
                                      <span className="ml-2 text-xs text-[#667085]">{item.product.primaryCode}</span>
                                    </div>
                                    <div className="text-right text-xs text-[#667085]">
                                      Esperado: <span className="font-mono">{Number(item.expectedQuantity).toFixed(2)}</span>
                                    </div>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={inputVal}
                                      onChange={(e) => setCountInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                                      className="h-8 w-24 text-right"
                                      placeholder="Contado"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={savingItem === key}
                                      onClick={() => saveCountItem(c.id, item.productId)}
                                    >
                                      {savingItem === key ? "..." : "Guardar"}
                                    </Button>
                                    {item.countedQuantity !== null && (
                                      <span className={`text-xs font-mono ${Number(item.difference) < 0 ? "text-red-600" : Number(item.difference) > 0 ? "text-emerald-600" : "text-[#667085]"}`}>
                                        {Number(item.difference) > 0 ? "+" : ""}{Number(item.difference).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {isExpanded && c.status === "COMPLETED" && (
                          <div className="border-t border-[#E4E9F0] bg-[#F8F9FB]/50 px-4 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">Resultados del conteo</p>
                            <div className="space-y-1">
                              {c.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                                  <span className="min-w-0 flex-1 font-medium">{item.product.name}</span>
                                  <span className="text-xs text-[#667085]">Esperado: {Number(item.expectedQuantity).toFixed(2)}</span>
                                  <span className="text-xs text-[#667085]">Contado: {item.countedQuantity != null ? Number(item.countedQuantity).toFixed(2) : "—"}</span>
                                  <span className={`text-xs font-mono font-medium ${Number(item.difference) < 0 ? "text-red-600" : Number(item.difference) > 0 ? "text-emerald-600" : "text-[#667085]"}`}>
                                    {Number(item.difference) > 0 ? "+" : ""}{Number(item.difference).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
