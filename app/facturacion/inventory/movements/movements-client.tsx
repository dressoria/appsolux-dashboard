"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaginationBar } from "@/components/appsolux/people/pagination-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Movement = {
  id: string;
  date: string;
  direction: string;
  quantity: string;
  movementType: string;
  reference: string | null;
  unitCost: string | null;
  product: { id: string; name: string; primaryCode: string | null };
  warehouse: { id: string; code: string; name: string };
};

type Warehouse = { id: string; name: string };

const TYPE_LABELS: Record<string, string> = {
  OPENING: "Apertura",
  SALE: "Venta",
  SALE_RETURN: "Dev. venta",
  PURCHASE_RECEIPT: "Compra",
  PURCHASE_RETURN: "Dev. compra",
  TRANSFER_IN: "Transfer. entrada",
  TRANSFER_OUT: "Transfer. salida",
  PHYSICAL_COUNT: "Conteo físico",
  ADJUSTMENT_IN: "Ajuste entrada",
  ADJUSTMENT_OUT: "Ajuste salida",
  COMBO_CONSUMPTION: "Consumo combo",
  OTHER: "Otro",
};

const MOVEMENT_TYPES = Object.entries(TYPE_LABELS);

type Filters = {
  warehouseId: string;
  movementType: string;
  dateFrom: string;
  dateTo: string;
};

export function MovementsClient({
  initialMovements,
  initialTotal,
  warehouses,
  page,
  perPage,
  filters,
}: {
  initialMovements: Movement[];
  initialTotal: number;
  warehouses: Warehouse[];
  page: number;
  perPage: number;
  filters: Filters;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  function buildUrl(overrides: Record<string, string | number>) {
    const params: Record<string, string> = {
      ...filters,
      page: String(page),
      perPage: String(perPage),
    };
    for (const [k, v] of Object.entries(overrides)) params[k] = String(v);
    for (const k of Object.keys(params)) {
      if (!params[k] || params[k] === "1" && k === "page" || params[k] === "20" && k === "perPage") {
        delete params[k];
      }
    }
    return `/facturacion/inventory/movements?${new URLSearchParams(params)}`;
  }

  async function submitAdjustment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      productId: fd.get("productId"),
      warehouseId: fd.get("warehouseId"),
      quantity: Number(fd.get("quantity")),
      type: fd.get("type"),
      reason: fd.get("reason") || undefined,
      reference: fd.get("reference") || undefined,
    };
    const res = await fetch("/api/inventory/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setFormLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError((data as { error?: string }).error ?? "Error al registrar ajuste.");
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancelar" : "+ Nuevo ajuste"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-[#1E52F1]/20 bg-[#1E52F1]/[0.02]">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#172033]">Registrar ajuste de inventario</h3>
            <form onSubmit={submitAdjustment} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Tipo</label>
                <select name="type" required className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm">
                  <option value="ADJUSTMENT_IN">Ajuste entrada (+)</option>
                  <option value="ADJUSTMENT_OUT">Ajuste salida (−)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Bodega</label>
                <select name="warehouseId" required className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm">
                  <option value="">Seleccionar</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">ID Producto</label>
                <Input name="productId" required placeholder="ID del producto" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Cantidad</label>
                <Input name="quantity" type="number" step="0.01" min="0.01" required placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Referencia</label>
                <Input name="reference" placeholder="Opcional" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Razón</label>
                <Input name="reason" placeholder="Opcional" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
                <Button type="submit" disabled={formLoading} className="bg-[#1E52F1] text-white hover:bg-[#1745CE]">
                  {formLoading ? "Registrando..." : "Registrar ajuste"}
                </Button>
                {formError && <span className="text-sm text-red-600">{formError}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.warehouseId}
          onChange={(e) => router.push(buildUrl({ warehouseId: e.target.value, page: 1 }))}
          className="h-8 rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
        >
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select
          value={filters.movementType}
          onChange={(e) => router.push(buildUrl({ movementType: e.target.value, page: 1 }))}
          className="h-8 rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => router.push(buildUrl({ dateFrom: e.target.value, page: 1 }))}
          className="h-8 w-auto"
          aria-label="Desde"
        />
        <span className="text-xs text-[#667085]">a</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => router.push(buildUrl({ dateTo: e.target.value, page: 1 }))}
          className="h-8 w-auto"
          aria-label="Hasta"
        />
        {(filters.warehouseId || filters.movementType || filters.dateFrom || filters.dateTo) && (
          <Button size="sm" variant="ghost" onClick={() => router.push("/facturacion/inventory/movements")} className="text-xs text-[#667085]">
            Limpiar filtros
          </Button>
        )}
      </div>

      <Card className="border-[#E4E9F0]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E4E9F0] bg-[#F8F9FB]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Producto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Bodega</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Entrada</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Salida</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Costo unit.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {initialMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[#667085]">
                      No hay movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  initialMovements.map((m) => (
                    <tr key={m.id} className="border-b border-[#E4E9F0] last:border-0 hover:bg-[#F8F9FB] transition-colors">
                      <td className="px-4 py-2.5 text-xs">{new Date(m.date).toLocaleDateString("es-EC")}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-[#172033]">{m.product.name}</span>
                        {m.product.primaryCode && <span className="ml-2 text-xs text-[#667085]">{m.product.primaryCode}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#667085]">{m.warehouse.name}</td>
                      <td className="px-4 py-2.5 text-xs">{TYPE_LABELS[m.movementType] ?? m.movementType}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600">
                        {m.direction === "IN" ? `+${Number(m.quantity).toFixed(2)}` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-red-600">
                        {m.direction === "OUT" ? `-${Number(m.quantity).toFixed(2)}` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{m.unitCost ? `$${Number(m.unitCost).toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-[#667085]">{m.reference ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#E4E9F0]">
            <PaginationBar
              page={page}
              perPage={perPage}
              total={initialTotal}
              onPageChange={(p) => router.push(buildUrl({ page: p }))}
              onPerPageChange={(pp) => router.push(buildUrl({ perPage: pp, page: 1 }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
