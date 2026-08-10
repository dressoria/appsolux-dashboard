"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EmissionDefaults = {
  establishmentCode: string;
  establishmentName: string;
  address: string;
  issuePointCode: string;
  nextNumber: number;
  hasLocalHistory: boolean;
};

export function SriEmissionSetupForm({ defaults }: { defaults: EmissionDefaults }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasPreviousInvoices, setHasPreviousInvoices] = useState(defaults.nextNumber > 1);
  const [establishmentCode, setEstablishmentCode] = useState(defaults.establishmentCode);
  const [issuePointCode, setIssuePointCode] = useState(defaults.issuePointCode);
  const [lastIssuedNumber, setLastIssuedNumber] = useState(Math.max(defaults.nextNumber - 1, 1));
  const nextNumber = hasPreviousInvoices ? lastIssuedNumber + 1 : 1;
  const formattedNumber = `${establishmentCode || "001"}-${issuePointCode || "001"}-${String(nextNumber).padStart(9, "0")}`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const response = await fetch("/api/sri/emission-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentCode,
          establishmentName: form.get("establishmentName"),
          address: form.get("address"),
          issuePointCode,
          hasPreviousInvoices,
          lastIssuedNumber: hasPreviousInvoices ? lastIssuedNumber : 0,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar la configuración.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="establishmentCode">Establecimiento *</Label>
          <Input id="establishmentCode" inputMode="numeric" value={establishmentCode} onChange={(event) => setEstablishmentCode(event.target.value.replace(/\D/g, "").slice(0, 3))} required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="establishmentName">Nombre *</Label>
          <Input id="establishmentName" name="establishmentName" defaultValue={defaults.establishmentName} required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="emissionAddress">Dirección *</Label>
          <Input id="emissionAddress" name="address" defaultValue={defaults.address} required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuePointCode">Punto de emisión *</Label>
          <Input id="issuePointCode" inputMode="numeric" value={issuePointCode} onChange={(event) => setIssuePointCode(event.target.value.replace(/\D/g, "").slice(0, 3))} required className="h-11 rounded-xl" />
        </div>
        <div className="rounded-2xl bg-[#eee5f7] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-facturom-primary-soft">Tu próxima factura</p>
          <p className="mt-2 font-mono text-lg font-black text-facturom-primary">{formattedNumber}</p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-black text-slate-900">¿Desde qué número quieres continuar?</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3.5">
          <input type="radio" checked={!hasPreviousInvoices} onChange={() => setHasPreviousInvoices(false)} className="mt-1 accent-facturom-primary" />
          <span><span className="block text-sm font-bold">Es mi primera vez facturando electrónicamente</span><span className="text-xs text-slate-500">Facturom comenzará desde 000000001.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3.5">
          <input type="radio" checked={hasPreviousInvoices} onChange={() => setHasPreviousInvoices(true)} className="mt-1 accent-facturom-primary" />
          <span className="flex-1"><span className="block text-sm font-bold">Ya emitía facturas antes</span><span className="text-xs text-slate-500">Indica el último número usado en tu sistema anterior.</span></span>
        </label>
        {hasPreviousInvoices ? (
          <div className="ml-7 max-w-xs space-y-2">
            <Label htmlFor="lastIssuedNumber">Último número emitido</Label>
            <Input id="lastIssuedNumber" type="number" min={1} value={lastIssuedNumber} onChange={(event) => setLastIssuedNumber(Math.max(Number(event.target.value) || 0, 0))} required />
          </div>
        ) : null}
      </fieldset>

      <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Confirma este número con tu historial anterior para evitar duplicados. Facturom impedirá retroceder si ya existe historial local.
      </div>
      {defaults.hasLocalHistory ? <p className="text-xs font-medium text-facturom-primary">Se detectó historial local y se propone el siguiente número disponible.</p> : null}
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Configuración de emisión guardada.</p> : null}
      <Button type="submit" disabled={saving} className="bg-facturom-primary text-white hover:bg-facturom-primary-soft">
        {saving ? "Guardando…" : "Guardar configuración de emisión"}
      </Button>
    </form>
  );
}
