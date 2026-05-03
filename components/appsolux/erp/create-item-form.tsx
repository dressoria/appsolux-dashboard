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
import type { ErpnextItem, ErpnextItemGroup, ErpnextUom } from "@/types/erpnext";

type CreateItemFormProps = {
  itemGroups: ErpnextItemGroup[];
  uoms: ErpnextUom[];
};

type CreateItemResponse = ApiResponse<{ item: ErpnextItem }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

const frequentUnits = [
  {
    label: "Unidad",
    matches: ["unidad", "unidad(es)", "unit", "units", "nos", "ea", "each"],
  },
  {
    label: "Caja",
    matches: ["caja", "box"],
  },
  {
    label: "Paquete",
    matches: ["paquete", "pack"],
  },
  {
    label: "Metro",
    matches: ["metro", "meter", "metre", "m"],
  },
  {
    label: "Litro",
    matches: ["litro", "liter", "litre", "l"],
  },
  {
    label: "Kilo",
    matches: ["kilo"],
  },
  {
    label: "Kilogramo",
    matches: ["kilogramo", "kilogram", "kg"],
  },
  {
    label: "Docena",
    matches: ["docena", "dozen"],
  },
  {
    label: "Par",
    matches: ["par", "pair"],
  },
  {
    label: "Servicio",
    matches: ["servicio", "service"],
  },
];

function getItemGroupLabel(itemGroup: ErpnextItemGroup) {
  return itemGroup.item_group_name ?? itemGroup.name;
}

function getFrequentUoms(uoms: ErpnextUom[]) {
  return frequentUnits
    .map((unit) => {
      const uom = uoms.find((erpUom) =>
        [erpUom.name, erpUom.uom_name ?? ""].some((value) =>
          unit.matches.includes(value.toLowerCase())
        )
      );

      return uom
        ? {
            label: unit.label,
            uom,
          }
        : null;
    })
    .filter((unit): unit is { label: string; uom: ErpnextUom } =>
      Boolean(unit)
    );
}

function getOrderedUoms(uoms: ErpnextUom[]) {
  const recommended = getFrequentUoms(uoms);
  const recommendedNames = new Set(recommended.map((unit) => unit.uom.name));
  const remaining = uoms
    .filter((uom) => !recommendedNames.has(uom.name))
    .map((uom) => ({ label: uom.uom_name ?? uom.name, uom }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return [...recommended, ...remaining];
}

export function CreateItemForm({ itemGroups, uoms }: CreateItemFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCreateItem = itemGroups.length > 0 && uoms.length > 0;
  const visibleUoms = getOrderedUoms(uoms);

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
      router.refresh();
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
          Agrega un producto para usarlo en inventario, ventas y POS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canCreateItem ? (
          <div className="mb-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Primero configura categorias de producto y unidades frecuentes en el
            ERP.
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
              <Label htmlFor="item_group">Categoria</Label>
              <select
                id="item_group"
                name="item_group"
                className={selectClassName}
                disabled={!canCreateItem}
                required
              >
                <option value="">Selecciona una categoria</option>
                {itemGroups.map((itemGroup) => (
                  <option key={itemGroup.name} value={itemGroup.name}>
                    {getItemGroupLabel(itemGroup)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                La categoria ayuda a organizar productos por familia, por
                ejemplo: belleza, accesorios, suplementos o repuestos.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_uom">Unidad</Label>
              <select
                id="stock_uom"
                name="stock_uom"
                className={selectClassName}
                disabled={!canCreateItem}
                required
              >
                <option value="">Selecciona una unidad</option>
                {visibleUoms.map((unit) => (
                  <option key={unit.uom.name} value={unit.uom.name}>
                    {unit.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Elige como se contara este producto. Para la mayoria de tiendas
                usa Unidad.
              </p>
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
            Maneja inventario
          </label>
          <p className="text-xs text-muted-foreground">
            Activalo si quieres controlar existencias de este producto.
            Desactivalo para servicios o productos sin stock.
          </p>

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
