"use client";

import { FormEvent, useState } from "react";
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
  ErpnextStockEntry,
  ErpnextWarehouse,
} from "@/types/erpnext";

type CreateStockEntryFormProps = {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
};

type CreateStockEntryResponse = ApiResponse<{
  stock_entry: ErpnextStockEntry;
}>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function CreateStockEntryForm({
  items,
  warehouses,
}: CreateStockEntryFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stockItems = items.filter(
    (item) => item.disabled !== 1 && item.is_stock_item !== 0
  );
  const usableWarehouses = warehouses.filter(
    (warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1
  );
  const canCreateStockEntry =
    stockItems.length > 0 && usableWarehouses.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      item_code: String(formData.get("item_code") ?? "").trim(),
      warehouse: String(formData.get("warehouse") ?? "").trim(),
      qty: Number(formData.get("qty") ?? 0),
      basic_rate: Number(formData.get("basic_rate") ?? 0),
    };

    try {
      const response = await fetch("/api/erpnext/stock-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateStockEntryResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Movimiento creado: ${result.data.stock_entry.name}`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear el movimiento de inventario"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrada de inventario</CardTitle>
        <CardDescription>
          Registra stock inicial o ingreso de productos en una bodega utilizable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canCreateStockEntry ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Primero se necesita al menos un producto de inventario y una bodega
            utilizable para registrar entradas de stock.
          </div>
        ) : null}

        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item_code">Producto</Label>
              <select
                id="item_code"
                name="item_code"
                className={selectClassName}
                disabled={!canCreateStockEntry}
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
              <Label htmlFor="warehouse">Bodega</Label>
              <select
                id="warehouse"
                name="warehouse"
                className={selectClassName}
                disabled={!canCreateStockEntry}
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
              <Label htmlFor="qty">Cantidad</Label>
              <Input
                id="qty"
                name="qty"
                type="number"
                min="0.01"
                step="0.01"
                disabled={!canCreateStockEntry}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="basic_rate">Costo unitario</Label>
              <Input
                id="basic_rate"
                name="basic_rate"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                disabled={!canCreateStockEntry}
              />
            </div>
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

          <Button type="submit" disabled={!canCreateStockEntry || isSubmitting}>
            {isSubmitting ? "Creando..." : "Crear entrada de stock"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
