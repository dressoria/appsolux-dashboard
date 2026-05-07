"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = {
  id: string;
  name: string;
  price: string;
  cost?: string | null;
  stock: number;
  minStock?: number | null;
  barcode?: string | null;
};

function stockStatus(product: Product) {
  if (product.stock <= 0) {
    return {
      label: "Agotado",
      className: "border-destructive/40 bg-destructive/5 text-destructive",
    };
  }

  if (product.minStock !== null && product.minStock !== undefined && product.stock <= product.minStock) {
    return {
      label: "Stock bajo",
      className: "border-amber-300 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Disponible",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
}

export function ProductInventory({ products }: { products: Product[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState("");
  const [adjustingId, setAdjustingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitJson(url: string, method: string, payload: unknown) {
    setMessage("");
    setError("");

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { ok?: boolean; message?: string };

    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? "No se pudo guardar.");
    }
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await submitJson(`/api/basic/products/${productId}`, "PATCH", {
        name: String(form.get("name") ?? ""),
        price: Number(form.get("price") ?? 0),
        cost: form.get("cost") ? Number(form.get("cost")) : undefined,
        minStock: form.get("minStock") ? Number(form.get("minStock")) : undefined,
        barcode: String(form.get("barcode") ?? ""),
      });
      setEditingId("");
      setMessage("Producto actualizado.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar.");
    }
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await submitJson(`/api/basic/products/${productId}/stock-adjustment`, "POST", {
        quantity: Number(form.get("quantity") ?? 0),
        reason: String(form.get("reason") ?? ""),
      });
      setAdjustingId("");
      setMessage("Stock ajustado.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo ajustar stock.");
    }
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {products.map((product) => {
        const status = stockStatus(product);
        const isEditing = editingId === product.id;
        const isAdjusting = adjustingId === product.id;

        return (
          <div key={product.id} className="space-y-3 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-muted-foreground">
                  ${Number(product.price).toFixed(2)} · stock {product.stock}
                  {product.minStock !== null && product.minStock !== undefined
                    ? ` · minimo ${product.minStock}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Codigo: {product.barcode || "sin codigo"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-1 text-xs ${status.className}`}>
                  {status.label}
                </span>
                <Button type="button" variant="outline" onClick={() => setEditingId(isEditing ? "" : product.id)}>
                  Editar
                </Button>
                <Button type="button" variant="outline" onClick={() => setAdjustingId(isAdjusting ? "" : product.id)}>
                  Ajustar stock
                </Button>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={(event) => updateProduct(event, product.id)} className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input name="name" defaultValue={product.name} required />
                </div>
                <div className="space-y-1">
                  <Label>Precio</Label>
                  <Input name="price" type="number" step="0.01" min="0" defaultValue={product.price} required />
                </div>
                <div className="space-y-1">
                  <Label>Costo</Label>
                  <Input name="cost" type="number" step="0.01" min="0" defaultValue={product.cost ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Minimo</Label>
                  <Input name="minStock" type="number" min="0" defaultValue={product.minStock ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Codigo</Label>
                  <Input name="barcode" defaultValue={product.barcode ?? ""} />
                </div>
                <div className="md:col-span-5">
                  <Button type="submit">Guardar cambios</Button>
                </div>
              </form>
            ) : null}

            {isAdjusting ? (
              <form onSubmit={(event) => adjustStock(event, product.id)} className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                <div className="space-y-1">
                  <Label>Ajuste</Label>
                  <Input name="quantity" type="number" placeholder="+5 o -2" required />
                </div>
                <div className="space-y-1">
                  <Label>Motivo</Label>
                  <Input name="reason" placeholder="Conteo, compra, merma" />
                </div>
                <div className="flex items-end">
                  <Button type="submit">Aplicar</Button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay productos para mostrar.</p>
      ) : null}
    </div>
  );
}
