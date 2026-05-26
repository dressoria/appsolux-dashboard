"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Establishment = { id: string; code: string; name: string };

export function SriIssuePointForm({ establishments }: { establishments: Establishment[] }) {
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
    const establishmentId = form.get("establishmentId") as string;

    if (!/^\d{3}$/.test(code)) {
      setError("El codigo debe tener exactamente 3 digitos (ejemplo: 001).");
      return;
    }
    if (!name) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!establishmentId) {
      setError("Selecciona un establecimiento.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sri/issue-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishmentId, code, name }),
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
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="establishmentId">Establecimiento *</Label>
          <select
            id="establishmentId"
            name="establishmentId"
            required
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Selecciona...</option>
            {establishments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} — {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Codigo *</Label>
          <Input id="code" name="code" placeholder="001" maxLength={3} pattern="\d{3}" required />
          <p className="text-xs text-muted-foreground">3 digitos.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" name="name" placeholder="Caja principal" required />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Punto de emision guardado correctamente.
        </div>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Guardando..." : "Agregar punto de emision"}
      </Button>
    </form>
  );
}
