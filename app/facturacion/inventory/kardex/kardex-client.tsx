"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type KardexRow = {
  id: string;
  date: string;
  movementType: string;
  reference: string | null;
  inQty: string;
  outQty: string;
  unitCost: string | null;
  balance: string;
  value: string | null;
};

type KardexData = {
  openingBalance: string;
  rows: KardexRow[];
  closingBalance: string;
};

type Product = { id: string; name: string; primaryCode: string | null };
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

export function KardexClient({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [data, setData] = useState<KardexData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");

  const filtered = productSearch
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.primaryCode?.toLowerCase().includes(productSearch.toLowerCase()) ?? false),
      ).slice(0, 20)
    : [];

  function selectProduct(p: Product) {
    setProductId(p.id);
    setSelectedProductName(p.name + (p.primaryCode ? ` (${p.primaryCode})` : ""));
    setProductSearch("");
    setShowDropdown(false);
  }

  async function load() {
    if (!productId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ productId });
      if (warehouseId) params.set("warehouseId", warehouseId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo + "T23:59:59");
      const res = await fetch(`/api/inventory/kardex?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const totalIn = data?.rows.reduce((sum, r) => sum + Number(r.inQty), 0) ?? 0;
  const totalOut = data?.rows.reduce((sum, r) => sum + Number(r.outQty), 0) ?? 0;

  return (
    <div className="space-y-4">
      <Card className="border-[#E4E9F0]">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="relative lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#667085]">Producto</label>
              {selectedProductName ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate rounded-lg border border-[#E4E9F0] bg-white px-3 py-1.5 text-sm">
                    {selectedProductName}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setProductId("");
                      setSelectedProductName("");
                      setData(null);
                    }}
                    className="text-xs text-[#667085]"
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Buscar por nombre o código..."
                  />
                  {showDropdown && filtered.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#E4E9F0] bg-white shadow-lg">
                      {filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProduct(p)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-[#F8F9FB] transition-colors"
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.primaryCode && <span className="ml-2 text-xs text-[#667085]">{p.primaryCode}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && productSearch && filtered.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#667085] shadow-lg">
                      Sin resultados
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#667085]">Bodega</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
              >
                <option value="">Todas</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#667085]">Desde</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8" />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#667085]">Hasta</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8" />
              </div>
              <Button
                onClick={load}
                disabled={loading || !productId}
                className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"
              >
                {loading ? "..." : "Consultar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#E4E9F0] bg-white p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">Saldo inicial</p>
              <p className="mt-1 text-2xl font-semibold text-[#172033]">{Number(data.openingBalance).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-[#E4E9F0] bg-white p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">Total entradas / salidas</p>
              <p className="mt-1 text-2xl font-semibold">
                <span className="text-emerald-600">+{totalIn.toFixed(2)}</span>
                <span className="mx-2 text-[#667085]">/</span>
                <span className="text-red-600">-{totalOut.toFixed(2)}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[#E4E9F0] bg-white p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">Saldo final</p>
              <p className="mt-1 text-2xl font-semibold text-[#172033]">{Number(data.closingBalance).toFixed(2)}</p>
            </div>
          </div>

          <Card className="border-[#E4E9F0]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E4E9F0] bg-[#F8F9FB]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Referencia</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Entrada</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Salida</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Costo unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Saldo</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-[#667085]">
                          Sin movimientos en el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((r) => (
                        <tr key={r.id} className="border-b border-[#E4E9F0] last:border-0 hover:bg-[#F8F9FB] transition-colors">
                          <td className="px-4 py-2.5 text-xs">{new Date(r.date).toLocaleDateString("es-EC")}</td>
                          <td className="px-4 py-2.5 text-xs">{TYPE_LABELS[r.movementType] ?? r.movementType}</td>
                          <td className="px-4 py-2.5 text-xs text-[#667085]">{r.reference ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600">
                            {Number(r.inQty) > 0 ? `+${Number(r.inQty).toFixed(2)}` : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-red-600">
                            {Number(r.outQty) > 0 ? `-${Number(r.outQty).toFixed(2)}` : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{r.unitCost ? `$${Number(r.unitCost).toFixed(2)}` : "—"}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-sm font-medium">{Number(r.balance).toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{r.value ? `$${Number(r.value).toFixed(2)}` : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
