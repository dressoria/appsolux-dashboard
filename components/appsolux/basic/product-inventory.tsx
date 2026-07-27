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
  taxRate?: string | null;
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
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
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

  async function deleteProduct(productId: string) {
    setIsDeleting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/basic/products/${productId}`, { method: "DELETE" });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo eliminar.");
      }

      setDeleteConfirmId("");
      setMessage("Producto eliminado.");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar.");
      setDeleteConfirmId("");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {products.map((product) => {
        const status = stockStatus(product);
        const isEditing = editingId === product.id;
        const isAdjusting = adjustingId === product.id;
        const isConfirmingDelete = deleteConfirmId === product.id;

        return (
          <div key={product.id} className="space-y-3 rounded-[22px] border border-slate-200 bg-white p-4 text-sm shadow-sm transition-colors hover:border-[#588100]/30 hover:shadow-[0_14px_40px_rgba(88,129,0,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-slate-950">{product.name}</p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {Number(product.cost ?? 0) > 0 ? `Costo $${Number(product.cost).toFixed(2)}` : "Sin costo"}
                  </span>
                  <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium border-slate-200 bg-slate-50 text-slate-600">
                    {product.taxRate && Number(product.taxRate) > 0 ? "Con IVA" : "Exento"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  ${Number(product.price).toFixed(2)} · stock {product.stock}
                  {product.minStock !== null && product.minStock !== undefined
                    ? ` · minimo ${product.minStock}`
                    : ""}
                </p>
                <p className="text-xs text-slate-400">
                  Codigo: {product.barcode || "sin codigo"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-slate-200 hover:border-[#588100]/30 hover:text-[#588100]"
                  onClick={() => {
                    setEditingId(isEditing ? "" : product.id);
                    setAdjustingId("");
                    setDeleteConfirmId("");
                  }}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-slate-200 hover:border-[#588100]/30 hover:text-[#588100]"
                  onClick={() => {
                    setAdjustingId(isAdjusting ? "" : product.id);
                    setEditingId("");
                    setDeleteConfirmId("");
                  }}
                >
                  Ajustar stock
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  onClick={() => {
                    setDeleteConfirmId(isConfirmingDelete ? "" : product.id);
                    setEditingId("");
                    setAdjustingId("");
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </div>

            {isConfirmingDelete ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-xs text-red-700">
                  ¿Eliminar <strong>{product.name}</strong>? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 border-red-300 px-3 text-xs text-red-700 hover:bg-red-100"
                    disabled={isDeleting}
                    onClick={() => deleteProduct(product.id)}
                  >
                    {isDeleting ? "Eliminando..." : "Confirmar eliminación"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-3 text-xs"
                    onClick={() => setDeleteConfirmId("")}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}

            {isEditing ? (
              <form onSubmit={(event) => updateProduct(event, product.id)} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Nombre</Label>
                  <Input name="name" defaultValue={product.name} required className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Precio</Label>
                  <Input name="price" type="number" step="0.01" min="0" defaultValue={product.price} required className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Costo</Label>
                  <Input name="cost" type="number" step="0.01" min="0" defaultValue={product.cost ?? ""} className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Minimo</Label>
                  <Input name="minStock" type="number" min="0" defaultValue={product.minStock ?? ""} className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Codigo</Label>
                  <Input name="barcode" defaultValue={product.barcode ?? ""} className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="md:col-span-5 flex items-center gap-3">
                  <Button type="submit" className="rounded-full bg-[#588100] px-5 text-white hover:bg-[#4b6f00]">
                    Guardar cambios
                  </Button>
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditingId("")}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : null}

            {isAdjusting ? (
              <form onSubmit={(event) => adjustStock(event, product.id)} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[160px_1fr_auto]">
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Ajuste</Label>
                  <Input name="quantity" type="number" placeholder="+5 o -2" required className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700">Motivo</Label>
                  <Input name="reason" placeholder="Conteo, compra, merma" className="h-10 rounded-xl border-slate-200 bg-white" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="rounded-full bg-[#588100] px-5 text-white hover:bg-[#4b6f00]">Aplicar</Button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      {products.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay productos para mostrar.
        </div>
      ) : null}
    </div>
  );
}
