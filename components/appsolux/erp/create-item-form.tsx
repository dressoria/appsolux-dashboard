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
import type { ErpnextItem, ErpnextItemGroup, ErpnextUom } from "@/types/erpnext";

type CreateItemFormProps = {
  itemGroups: ErpnextItemGroup[];
  uoms: ErpnextUom[];
};

type CreateItemResponse = ApiResponse<{ item: ErpnextItem }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function getItemGroupLabel(itemGroup: ErpnextItemGroup) {
  return itemGroup.item_group_name ?? itemGroup.name;
}

function getUomLabel(uom: ErpnextUom) {
  return uom.uom_name ?? uom.name;
}

export function CreateItemForm({ itemGroups, uoms }: CreateItemFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCreateItem = itemGroups.length > 0 && uoms.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      item_code: String(formData.get("item_code") ?? "").trim(),
      item_name: String(formData.get("item_name") ?? "").trim(),
      item_group: String(formData.get("item_group") ?? "").trim(),
      stock_uom: String(formData.get("stock_uom") ?? "").trim(),
      is_stock_item: formData.get("is_stock_item") === "on",
    };

    try {
      const response = await fetch("/api/erpnext/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateItemResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Producto creado: ${result.data.item.item_code}`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el producto"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear producto</CardTitle>
        <CardDescription>
          Agrega un producto real a ERPNext para usarlo en inventario, ventas y
          POS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canCreateItem ? (
          <div className="mb-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Primero configura grupos de producto y unidades de medida en ERPNext.
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item_code">Codigo</Label>
              <Input id="item_code" name="item_code" disabled={!canCreateItem} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_name">Nombre</Label>
              <Input id="item_name" name="item_name" disabled={!canCreateItem} required />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item_group">Grupo de producto</Label>
              <select
                id="item_group"
                name="item_group"
                className={selectClassName}
                disabled={!canCreateItem}
                required
              >
                <option value="">Selecciona un grupo</option>
                {itemGroups.map((itemGroup) => (
                  <option key={itemGroup.name} value={itemGroup.name}>
                    {getItemGroupLabel(itemGroup)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_uom">Unidad de medida</Label>
              <select
                id="stock_uom"
                name="stock_uom"
                className={selectClassName}
                disabled={!canCreateItem}
                required
              >
                <option value="">Selecciona una unidad</option>
                {uoms.map((uom) => (
                  <option key={uom.name} value={uom.name}>
                    {getUomLabel(uom)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_stock_item"
              defaultChecked
              disabled={!canCreateItem}
              className="size-4"
            />
            Producto con inventario
          </label>

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

          <Button type="submit" disabled={!canCreateItem || isSubmitting}>
            {isSubmitting ? "Creando..." : "Crear producto"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
