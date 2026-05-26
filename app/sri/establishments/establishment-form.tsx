"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SriEstablishmentForm({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const code = (form.get("code") as string).trim();
    const name = (form.get("name") as string).trim();
    const address = (form.get("address") as string).trim();

    if (!/^\d{3}$/.test(code)) {
      setError("El codigo debe tener exactamente 3 digitos (ejemplo: 001).");
      return;
    }
    if (!name) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!address) {
      setError("La direccion es obligatoria.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sri/establishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          code,
          name,
          address,
          isMain: form.get("isMain") === "true",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar. Intenta de nuevo.");
        return;
      }

      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Codigo *</Label>
          <Input id="code" name="code" placeholder="001" maxLength={3} pattern="\d{3}" required />
          <p className="text-xs text-muted-foreground">3 digitos asignados por el SRI.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" name="name" placeholder="Sucursal principal" required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Direccion *</Label>
          <Input id="address" name="address" placeholder="Calle, numero, ciudad" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="isMain">Es establecimiento principal</Label>
          <select
            id="isMain"
            name="isMain"
            defaultValue="true"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="true">Si</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Establecimiento guardado correctamente.
        </div>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Guardando..." : "Agregar establecimiento"}
      </Button>
    </form>
  );
}
