"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextItem,
  ErpnextWarehouse,
  StockAdjustmentResult,
} from "@/types/erpnext";

type AdjustStockFormProps = {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
};

type AdjustStockResponse = ApiResponse<StockAdjustmentResult>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

const adjustmentReasons = [
  "Conteo fisico",
  "Producto danado",
  "Producto perdido",
  "Correccion de registro",
  "Devolucion",
  "Otro",
];

export function AdjustStockForm({ items, warehouses }: AdjustStockFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stockItems = items.filter(
    (item) => item.disabled !== 1 && item.is_stock_item !== 0
  );
  const usableWarehouses = warehouses.filter(
    (warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1
  );
  const canAdjustStock = stockItems.length > 0 && usableWarehouses.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      item_code: String(formData.get("item_code") ?? "").trim(),
      warehouse: String(formData.get("warehouse") ?? "").trim(),
      counted_qty: Number(formData.get("counted_qty") ?? 0),
      reason: String(formData.get("reason") ?? "").trim(),
      note: String(formData.get("note") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/erpnext/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as AdjustStockResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      if (result.data.difference === 0) {
        setMessage(
          "El stock contado coincide con el stock actual. No se necesita ajuste."
        );
        return;
      }

      setMessage("Inventario ajustado correctamente.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo ajustar el inventario"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajustar stock</CardTitle>
        <CardDescription>
          Ajusta el inventario cuando el conteo real no coincide con el sistema.
          Appsolux registrara un movimiento para mantener trazabilidad.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canAdjustStock ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Primero se necesita al menos un producto que maneje inventario y una
            bodega utilizable para ajustar stock.
          </div>
        ) : null}

        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adjust_item_code">Producto</Label>
              <select
                id="adjust_item_code"
                name="item_code"
                className={selectClassName}
                disabled={!canAdjustStock}
                required
              >
                <option value="">Selecciona un producto</option>
                {stockItems.map((item) => (
                  <option key={item.name} value={item.item_code}>
                    {item.item_name} ({item.item_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust_warehouse">Bodega / ubicacion</Label>
              <select
                id="adjust_warehouse"
                name="warehouse"
                className={selectClassName}
                disabled={!canAdjustStock}
                required
              >
                <option value="">Selecciona una bodega</option>
                {usableWarehouses.map((warehouse) => (
                  <option key={warehouse.name} value={warehouse.name}>
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="counted_qty">Stock contado real</Label>
              <Input
                id="counted_qty"
                name="counted_qty"
                type="number"
                min="0"
                step="0.01"
                disabled={!canAdjustStock}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo del ajuste</Label>
              <select
                id="reason"
                name="reason"
                className={selectClassName}
                disabled={!canAdjustStock}
                required
              >
                <option value="">Selecciona un motivo</option>
                {adjustmentReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Nota opcional</Label>
            <Input
              id="note"
              name="note"
              disabled={!canAdjustStock}
              placeholder="Ej. conteo de cierre, producto vencido, correccion interna"
            />
          </div>

          {message ? (
            <p
              className={
                isError
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={!canAdjustStock || isSubmitting}>
            {isSubmitting ? "Ajustando..." : "Ajustar stock"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
