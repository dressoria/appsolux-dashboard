"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProductForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget; // capture before any awaits — React nullifies currentTarget after async gaps
    setIsLoading(true);
    setMessage("");
    setError("");

    const form = new FormData(formElement);
    const payload = {
      name: String(form.get("name") ?? ""),
      price: Number(form.get("price") ?? 0),
      cost: form.get("cost") ? Number(form.get("cost")) : undefined,
      stock: form.get("stock") ? Number(form.get("stock")) : 0,
      minStock: form.get("minStock") ? Number(form.get("minStock")) : undefined,
      barcode: String(form.get("barcode") ?? ""),
      expiresAt: String(form.get("expiresAt") ?? ""),
      taxRate: Number(form.get("taxRate") ?? 0),
    };

    try {
      const response = await fetch("/api/basic/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo crear producto.");
      }

      formElement.reset();
      setMessage("Producto creado.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "No se pudo crear producto."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const fieldDisabled = isLoading || disabled;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Información principal
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-slate-700">Nombre del producto</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej. Camisa talla M"
              required
              disabled={fieldDisabled}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price" className="text-slate-700">Precio de venta</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
              disabled={fieldDisabled}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cost">
              Costo{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              disabled={fieldDisabled}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor="taxRate" className="text-slate-700">IVA del producto</Label>
          <select
            id="taxRate"
            name="taxRate"
            defaultValue="0"
            disabled={fieldDisabled}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm sm:max-w-[220px]"
          >
            <option value="0">0% — Exento / no gravado</option>
            <option value="8">8% — Tarifa reducida</option>
            <option value="15">15% — Tarifa general</option>
          </select>
          <p className="text-xs text-slate-400">
            Se aplica al calcular totales de venta y factura SRI.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Inventario
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock" className="text-slate-700">Stock inicial</Label>
            <Input
              id="stock"
              name="stock"
              type="number"
              min="0"
              defaultValue="0"
              disabled={fieldDisabled}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minStock">
              Stock mínimo{" "}
              <span className="text-slate-400 font-normal">(alerta)</span>
            </Label>
            <Input
              id="minStock"
              name="minStock"
              type="number"
              min="0"
              placeholder="Ej. 5"
              disabled={fieldDisabled}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Catálogo
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="barcode">
              Código de barras{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              id="barcode"
              name="barcode"
              placeholder="Ej. 7501000000000"
              disabled={fieldDisabled}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiresAt">
              Fecha de vencimiento{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              id="expiresAt"
              name="expiresAt"
              type="date"
              disabled={fieldDisabled}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={fieldDisabled}
          className="rounded-full bg-[#588100] px-5 text-white hover:bg-[#4b6f00]"
        >
          {isLoading ? "Guardando..." : "Crear producto"}
        </Button>
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
