"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DOCUMENT_TYPES = [
  { value: "INVOICE", label: "Factura" },
  { value: "CREDIT_NOTE", label: "Nota de credito" },
  { value: "DEBIT_NOTE", label: "Nota de debito" },
  { value: "WITHHOLDING", label: "Retencion" },
  { value: "REFERRAL_GUIDE", label: "Guia de remision" },
];

type Establishment = { id: string; code: string; name: string };
type IssuePoint = { id: string; code: string; name: string; establishmentId: string; establishmentCode: string };

export function SriSequenceForm({
  establishments,
  issuePoints,
}: {
  establishments: Establishment[];
  issuePoints: IssuePoint[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState("");

  const filteredIssuePoints = issuePoints.filter(
    (ip) => !selectedEstablishment || ip.establishmentId === selectedEstablishment
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const establishmentId = form.get("establishmentId") as string;
    const issuePointId = form.get("issuePointId") as string;
    const documentType = form.get("documentType") as string;
    const startNumber = parseInt(form.get("startNumber") as string, 10);

    if (!establishmentId || !issuePointId || !documentType) {
      setError("Completa todos los campos requeridos.");
      return;
    }
    if (!Number.isInteger(startNumber) || startNumber < 1) {
      setError("El numero inicial debe ser un entero mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sri/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId,
          issuePointId,
          documentType,
          startNumber,
          currentNumber: startNumber,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar. Intenta de nuevo.");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="establishmentId">Establecimiento *</Label>
          <select
            id="establishmentId"
            name="establishmentId"
            required
            value={selectedEstablishment}
            onChange={(e) => setSelectedEstablishment(e.target.value)}
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
          <Label htmlFor="issuePointId">Punto de emision *</Label>
          <select
            id="issuePointId"
            name="issuePointId"
            required
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Selecciona...</option>
            {filteredIssuePoints.map((ip) => (
              <option key={ip.id} value={ip.id}>
                {ip.establishmentCode}-{ip.code} {ip.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="documentType">Tipo de comprobante *</Label>
          <select
            id="documentType"
            name="documentType"
            required
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Selecciona...</option>
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startNumber">Numero inicial *</Label>
          <Input id="startNumber" name="startNumber" type="number" min={1} defaultValue={1} required />
          <p className="text-xs text-muted-foreground">Se mostrara como 000000001.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Secuencial configurado correctamente.
        </div>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Guardando..." : "Guardar secuencial"}
      </Button>
    </form>
  );
}
