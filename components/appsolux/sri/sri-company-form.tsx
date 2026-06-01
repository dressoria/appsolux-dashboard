"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SriCompanyFormProfile = {
  legalName: string;
  tradeName: string | null;
  ruc: string;
  environment: "TEST" | "PRODUCTION";
  accountingRequired: boolean;
  specialTaxpayerNumber: string | null;
  withholdingAgentResolution: string | null;
};

function validateRucFormat(ruc: string) {
  return /^\d{13}$/.test(ruc.trim());
}

export function SriCompanyForm({
  initialProfile,
}: {
  initialProfile: SriCompanyFormProfile | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const ruc = (form.get("ruc") as string).trim();
    const legalName = (form.get("legalName") as string).trim();

    if (!legalName) {
      setError("La razon social es obligatoria.");
      return;
    }
    if (!validateRucFormat(ruc)) {
      setError("El RUC debe tener exactamente 13 digitos numericos.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sri/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          tradeName: form.get("tradeName") || null,
          ruc,
          accountingRequired: form.get("accountingRequired") === "true",
          specialTaxpayerNumber: form.get("specialTaxpayerNumber") || null,
          withholdingAgentResolution: form.get("withholdingAgentResolution") || null,
          environment: form.get("environment") || "TEST",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "No se pudo guardar. Intenta de nuevo.");
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
    <Card>
      <CardHeader>
        <CardTitle>Datos del contribuyente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">Razon social *</Label>
              <Input
                id="legalName"
                name="legalName"
                placeholder="Nombre legal segun RUC"
                defaultValue={initialProfile?.legalName ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradeName">Nombre comercial</Label>
              <Input
                id="tradeName"
                name="tradeName"
                placeholder="Opcional"
                defaultValue={initialProfile?.tradeName ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruc">RUC *</Label>
              <Input
                id="ruc"
                name="ruc"
                placeholder="0000000000001"
                maxLength={13}
                pattern="\d{13}"
                defaultValue={initialProfile?.ruc ?? ""}
                required
              />
              <p className="text-xs text-muted-foreground">13 digitos numericos.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="environment">Ambiente preferido</Label>
              <select
                id="environment"
                name="environment"
                defaultValue={initialProfile?.environment ?? "TEST"}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="TEST">Pruebas (TEST) — recomendado para inicio</option>
                <option value="PRODUCTION">Produccion — solo cuando la config este completa</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountingRequired">Obligado a llevar contabilidad</Label>
              <select
                id="accountingRequired"
                name="accountingRequired"
                defaultValue={initialProfile?.accountingRequired ? "true" : "false"}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="false">No</option>
                <option value="true">Si</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialTaxpayerNumber">Contribuyente especial (numero de resolucion)</Label>
              <Input
                id="specialTaxpayerNumber"
                name="specialTaxpayerNumber"
                placeholder="Opcional"
                defaultValue={initialProfile?.specialTaxpayerNumber ?? ""}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="withholdingAgentResolution">Agente de retencion (resolucion)</Label>
              <Input
                id="withholdingAgentResolution"
                name="withholdingAgentResolution"
                placeholder="Opcional"
                defaultValue={initialProfile?.withholdingAgentResolution ?? ""}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
              Datos guardados correctamente.
            </div>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar datos de empresa"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
