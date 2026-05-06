"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProductForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      price: Number(form.get("price") ?? 0),
      cost: form.get("cost") ? Number(form.get("cost")) : undefined,
      stock: form.get("stock") ? Number(form.get("stock")) : 0,
      minStock: form.get("minStock") ? Number(form.get("minStock")) : undefined,
      barcode: String(form.get("barcode") ?? ""),
      expiresAt: String(form.get("expiresAt") ?? ""),
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

      event.currentTarget.reset();
      setMessage("Producto creado.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear producto."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">Producto</Label>
        <Input id="name" name="name" required disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Precio</Label>
        <Input id="price" name="price" type="number" step="0.01" min="0" required disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cost">Costo</Label>
        <Input id="cost" name="cost" type="number" step="0.01" min="0" disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stock">Stock</Label>
        <Input id="stock" name="stock" type="number" min="0" defaultValue="0" disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="minStock">Stock minimo</Label>
        <Input id="minStock" name="minStock" type="number" min="0" disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="barcode">Codigo de barras</Label>
        <Input id="barcode" name="barcode" disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="expiresAt">Vence</Label>
        <Input id="expiresAt" name="expiresAt" type="date" disabled={isLoading} />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Guardando..." : "Crear producto"}
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
