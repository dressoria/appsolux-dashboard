"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SriCompanyFormProfile = {
  legalName: string;
  tradeName: string | null;
  ruc: string;
  dirMatriz: string | null;
  accountingRequired: boolean;
  specialTaxpayerNumber: string | null;
  withholdingAgentResolution: string | null;
};

export type SriCompanyPrefill = {
  identificationType: "ruc" | "cedula";
  legalName: string;
  tradeName: string;
  ruc: string;
  address: string;
};

export function SriCompanyForm({
  initialProfile,
  prefill,
}: {
  initialProfile: SriCompanyFormProfile | null;
  prefill: SriCompanyPrefill;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [identificationType, setIdentificationType] = useState<"ruc" | "cedula">(prefill.identificationType);
  const [additionalOpen, setAdditionalOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    const ruc = String(form.get("ruc") ?? "").trim();
    const legalName = String(form.get("legalName") ?? "").trim();
    const dirMatriz = String(form.get("dirMatriz") ?? "").trim();

    if (!legalName) return setError("Escribe la razón social o nombre fiscal.");
    if (!/^\d{13}$/.test(ruc)) return setError("Para emitir electrónicamente necesitas un RUC válido de 13 dígitos.");
    if (!dirMatriz) return setError("Escribe la dirección matriz.");

    setSaving(true);
    try {
      const response = await fetch("/api/sri/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          tradeName: form.get("tradeName") || null,
          ruc,
          dirMatriz,
          accountingRequired: form.get("accountingRequired") === "true",
          specialTaxpayerNumber: form.get("specialTaxpayerNumber") || null,
          withholdingAgentResolution: form.get("withholdingAgentResolution") || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-facturom-bg p-1.5">
        {(["ruc", "cedula"] as const).map((type) => (
          <button key={type} type="button" onClick={() => setIdentificationType(type)} className={cn("rounded-xl px-3 py-2.5 text-sm font-bold transition", identificationType === type ? "bg-facturom-primary text-white shadow-sm" : "text-slate-500 hover:bg-white")}>
            {type === "ruc" ? "Empresa / RUC" : "Persona natural"}
          </button>
        ))}
      </div>
      {identificationType === "cedula" ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El SRI identifica a la persona por cédula, pero para emitir comprobantes electrónicos debes ingresar tu RUC de persona natural de 13 dígitos.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ruc">RUC emisor *</Label>
          <Input id="ruc" name="ruc" inputMode="numeric" maxLength={13} pattern="\d{13}" defaultValue={initialProfile?.ruc ?? prefill.ruc} placeholder="0000000000001" required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="legalName">Razón social / Nombre fiscal *</Label>
          <Input id="legalName" name="legalName" defaultValue={initialProfile?.legalName ?? prefill.legalName} required className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tradeName">Nombre comercial</Label>
          <Input id="tradeName" name="tradeName" defaultValue={initialProfile?.tradeName ?? prefill.tradeName} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountingRequired">Obligado a llevar contabilidad</Label>
          <select id="accountingRequired" name="accountingRequired" defaultValue={initialProfile?.accountingRequired ? "true" : "false"} className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm">
            <option value="false">No</option>
            <option value="true">Sí</option>
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="dirMatriz">Dirección matriz *</Label>
          <Input id="dirMatriz" name="dirMatriz" defaultValue={initialProfile?.dirMatriz ?? prefill.address} required className="h-11 rounded-xl" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200">
        <button type="button" onClick={() => setAdditionalOpen((open) => !open)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-slate-700">
          Datos tributarios adicionales
          <ChevronDown className={cn("h-4 w-4 transition", additionalOpen && "rotate-180")} />
        </button>
        {additionalOpen ? (
          <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="specialTaxpayerNumber">Contribuyente especial</Label>
              <Input id="specialTaxpayerNumber" name="specialTaxpayerNumber" placeholder="Número de resolución" defaultValue={initialProfile?.specialTaxpayerNumber ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withholdingAgentResolution">Agente de retención</Label>
              <Input id="withholdingAgentResolution" name="withholdingAgentResolution" placeholder="Número de resolución" defaultValue={initialProfile?.withholdingAgentResolution ?? ""} />
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Datos fiscales guardados.</p> : null}
      <Button type="submit" disabled={saving} className="bg-facturom-primary text-white hover:bg-facturom-primary-soft">
        {saving ? "Guardando…" : "Guardar datos fiscales"}
      </Button>
    </form>
  );
}
