"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextBin,
  ErpnextItem,
  ErpnextWarehouse,
  StockAdjustmentResult,
} from "@/types/erpnext";

type Props = {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
  inventory: ErpnextBin[];
};

type CountRow = {
  item_code: string;
  item_name: string;
  system_qty: number;
  counted: string;
  applying: boolean;
  result: string | null;
  isError: boolean;
};

type AdjustResponse = ApiResponse<StockAdjustmentResult>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function formatQty(value: number) {
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 4 }).format(value);
}

export function PhysicalCountTable({ items, warehouses, inventory }: Props) {
  const operativeWarehouses = warehouses.filter(
    (w) => w.is_group !== 1 && w.disabled !== 1
  );
  const stockItemMap = new Map(items.map((i) => [i.item_code, i.item_name]));

  const [selectedWarehouse, setSelectedWarehouse] = useState(
    operativeWarehouses[0]?.name ?? ""
  );

  const binsByWarehouse = inventory.filter(
    (b) => b.warehouse === selectedWarehouse
  );

  const [countRows, setCountRows] = useState<CountRow[]>([]);

  function loadWarehouse(warehouseName: string) {
    setSelectedWarehouse(warehouseName);
    const bins = inventory.filter((b) => b.warehouse === warehouseName);
    setCountRows(
      bins.map((b) => ({
        item_code: b.item_code,
        item_name: stockItemMap.get(b.item_code) ?? b.item_code,
        system_qty: b.actual_qty ?? 0,
        counted: String(b.actual_qty ?? 0),
        applying: false,
        result: null,
        isError: false,
      }))
    );
  }

  function updateCounted(item_code: string, value: string) {
    setCountRows((prev) =>
      prev.map((r) =>
        r.item_code === item_code
          ? { ...r, counted: value, result: null, isError: false }
          : r
      )
    );
  }

  async function applyAdjustment(item_code: string) {
    const row = countRows.find((r) => r.item_code === item_code);
    if (!row) return;
    const counted_qty = parseFloat(row.counted);
    if (isNaN(counted_qty) || counted_qty < 0) {
      setCountRows((prev) =>
        prev.map((r) =>
          r.item_code === item_code
            ? { ...r, result: "Cantidad invalida.", isError: true }
            : r
        )
      );
      return;
    }

    setCountRows((prev) =>
      prev.map((r) =>
        r.item_code === item_code ? { ...r, applying: true, result: null, isError: false } : r
      )
    );

    try {
      const response = await fetch("/api/erpnext/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code,
          warehouse: selectedWarehouse,
          counted_qty,
          reason: "Toma fisica",
        }),
      });
      const result = (await response.json()) as AdjustResponse;

      if (!result.success) {
        setCountRows((prev) =>
          prev.map((r) =>
            r.item_code === item_code
              ? { ...r, applying: false, result: result.error.message, isError: true }
              : r
          )
        );
        return;
      }

      const { difference, document_name } = result.data;
      const msg =
        difference === 0
          ? "Sin diferencia."
          : `Ajuste aplicado${document_name ? ` (${document_name})` : ""}.`;

      setCountRows((prev) =>
        prev.map((r) =>
          r.item_code === item_code
            ? {
                ...r,
                applying: false,
                system_qty: counted_qty,
                result: msg,
                isError: false,
              }
            : r
        )
      );
    } catch (err) {
      setCountRows((prev) =>
        prev.map((r) =>
          r.item_code === item_code
            ? {
                ...r,
                applying: false,
                result: err instanceof Error ? err.message : "Error al ajustar.",
                isError: true,
              }
            : r
        )
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Bodega a contar</label>
        <select
          className={selectClassName + " max-w-sm"}
          value={selectedWarehouse}
          onChange={(e) => loadWarehouse(e.target.value)}
        >
          <option value="">Selecciona bodega</option>
          {operativeWarehouses.map((w) => (
            <option key={w.name} value={w.name}>
              {w.warehouse_name}
            </option>
          ))}
        </select>
      </div>

      {selectedWarehouse && binsByWarehouse.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No hay stock registrado en esta bodega. Ingresa mercaderia o aplica ajustes para comenzar.
        </div>
      ) : null}

      {countRows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pl-3 pr-2 text-left font-medium">Producto</th>
                <th className="py-2 pr-2 text-right font-medium">Stock sistema</th>
                <th className="py-2 pr-2 text-left font-medium">Conteo real</th>
                <th className="py-2 pr-2 text-right font-medium">Diferencia</th>
                <th className="py-2 pr-2 font-medium">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {countRows.map((row) => {
                const counted = parseFloat(row.counted);
                const diff = isNaN(counted) ? null : counted - row.system_qty;
                const hasDiff = diff !== null && diff !== 0;
                return (
                  <tr key={row.item_code}>
                    <td className="py-2 pl-3 pr-2">
                      <span className="font-medium">{row.item_name}</span>
                      <span className="ml-1 text-xs text-muted-foreground">({row.item_code})</span>
                    </td>
                    <td className="py-2 pr-2 text-right text-muted-foreground">
                      {formatQty(row.system_qty)}
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={row.counted}
                        onChange={(e) => updateCounted(row.item_code, e.target.value)}
                        className="h-8 w-24"
                        disabled={row.applying}
                      />
                    </td>
                    <td
                      className={`py-2 pr-2 text-right font-semibold ${
                        diff === null
                          ? "text-muted-foreground"
                          : diff > 0
                            ? "text-green-700"
                            : diff < 0
                              ? "text-rose-600"
                              : "text-muted-foreground"
                      }`}
                    >
                      {diff === null ? "-" : diff > 0 ? `+${formatQty(diff)}` : formatQty(diff)}
                    </td>
                    <td className="py-2 pr-2">
                      {row.result ? (
                        <span
                          className={`text-xs ${row.isError ? "text-destructive" : "text-green-700"}`}
                        >
                          {row.result}
                        </span>
                      ) : hasDiff ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyAdjustment(row.item_code)}
                          disabled={row.applying}
                        >
                          {row.applying ? "Ajustando..." : "Aplicar ajuste"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin diferencia</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
