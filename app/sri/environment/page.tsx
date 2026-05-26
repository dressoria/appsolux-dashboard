"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";

export default function SriEnvironmentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function setEnvironment(env: "TEST" | "PRODUCTION") {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/sri/environment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: env }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo cambiar el ambiente.");
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
    <SriModuleShell
      title="Ambiente"
      description="Controla si los comprobantes se emitiran en ambiente de pruebas o produccion del SRI."
      activeHref={routes.sriEnvironment}
    >
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Importante</p>
        <p className="mt-1">
          La emision real contra el SRI no esta habilitada en esta fase.
          Este ajuste prepara la configuracion para cuando la emision se active.
          Mantente en <strong>Pruebas</strong> hasta que la configuracion este completa y verificada.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ambiente de pruebas (TEST)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Los comprobantes se envian al servidor de pruebas del SRI.
              No generan obligaciones tributarias. Recomendado para validar la configuracion.
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Certificado de firma para pruebas</li>
              <li>• Sin efectos tributarios reales</li>
              <li>• Ideal para verificar datos y secuenciales</li>
            </ul>
            <Button
              onClick={() => setEnvironment("TEST")}
              disabled={saving}
              variant="outline"
              className="w-full"
            >
              {saving ? "Aplicando..." : "Usar ambiente de pruebas"}
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle>Ambiente de produccion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Los comprobantes se envian al SRI con validez tributaria real.
              Solo activar cuando la configuracion este completa y la firma electronica este lista.
            </p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Requiere: empresa configurada, establecimientos, puntos de emision,
              secuenciales y firma electronica valida cargada.
            </div>
            <Button
              onClick={() => setEnvironment("PRODUCTION")}
              disabled={saving}
              variant="outline"
              className="w-full"
            >
              {saving ? "Aplicando..." : "Cambiar a produccion"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Ambiente actualizado correctamente.
        </div>
      )}
    </SriModuleShell>
  );
}
