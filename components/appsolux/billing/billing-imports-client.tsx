"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import type { BillingImportPreviewResult, BillingImportType, BillingImportConfirmResult } from "@/lib/core/business-suite/billing-imports";

type AuditSummary = {
  id: string;
  createdAt: string;
  type: string;
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
};

type Props = {
  initialType: BillingImportType;
  history: AuditSummary[];
};

type PreviewResponse = {
  success: true;
  data: { preview: BillingImportPreviewResult };
} | {
  success: false;
  error: { message: string };
};

type ConfirmResponse = {
  success: true;
  data: { result: BillingImportConfirmResult };
} | {
  success: false;
  error: { message: string };
};

const tabClass =
  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors";

export function BillingImportsClient({ initialType, history }: Props) {
  const [type, setType] = useState<BillingImportType>(initialType);
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<BillingImportPreviewResult | null>(null);
  const [result, setResult] = useState<BillingImportConfirmResult | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const currentRows = preview?.rows ?? [];
  const blockers = preview?.blockers ?? [];

  const readyToConfirm = useMemo(() => {
    if (!preview) return false;
    if (preview.blockers.length > 0) return false;
    return preview.rows.some((row) => row.status !== "error");
  }, [preview]);

  async function readFile(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);
    setPreview(null);
    setResult(null);
    setMessage(null);
    setIsError(false);
  }

  async function handlePreview() {
    if (!csvText.trim()) {
      setIsError(true);
      setMessage("Selecciona un archivo CSV antes de previsualizar.");
      return;
    }

    setIsPreviewing(true);
    setMessage(null);
    setResult(null);
    setIsError(false);

    try {
      const response = await fetch("/api/billing/imports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, csvText }),
      });
      const payload = (await response.json()) as PreviewResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "No se pudo generar la previsualización." : payload.error.message);
      }

      setPreview(payload.data.preview);
      setMessage("Previsualización lista. Revisa filas, advertencias y bloqueos antes de importar.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo generar la previsualización.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!readyToConfirm) return;

    setIsConfirming(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/billing/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, csvText, updateExisting }),
      });
      const payload = (await response.json()) as ConfirmResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "No se pudo confirmar la importación." : payload.error.message);
      }

      setResult(payload.data.result);
      setMessage("Importación ejecutada. Revisa el resumen y las filas fallidas si hubo errores.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar la importación.");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm shadow-slate-200/60">
        <CardHeader>
          <CardTitle>Cargas masivas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${tabClass} ${
                type === "products" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
              }`}
              onClick={() => {
                setType("products");
                setPreview(null);
                setResult(null);
                setMessage(null);
              }}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Productos
            </button>
            <button
              type="button"
              className={`${tabClass} ${
                type === "customers" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
              }`}
              onClick={() => {
                setType("customers");
                setPreview(null);
                setResult(null);
                setMessage(null);
              }}
            >
              <Users className="mr-2 h-4 w-4" />
              Clientes
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="billing-import-file">Archivo CSV</Label>
              <Input
                id="billing-import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                }}
              />
              <p className="text-xs text-slate-500">
                Límite inicial: 500 filas por importación. XLSX queda preparado para una fase posterior.
              </p>
              {fileName ? <p className="text-xs text-slate-600">Archivo cargado: {fileName}</p> : null}
            </div>
            <div className="flex items-end">
              <Button asChild variant="outline" className="rounded-full">
                <a href={`/api/billing/imports/template?type=${type}`}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla
                </a>
              </Button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(event) => setUpdateExisting(event.target.checked)}
            />
            Actualizar registros existentes cuando haya match.
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handlePreview} disabled={isPreviewing}>
              <Upload className="mr-2 h-4 w-4" />
              {isPreviewing ? "Previsualizando..." : "Previsualizar importación"}
            </Button>
            <Button type="button" variant="outline" disabled={!readyToConfirm || isConfirming} onClick={handleConfirm}>
              {isConfirming ? "Importando..." : "Confirmar importación"}
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={type === "products" ? routes.facturacionProducts : routes.facturacionCustomers}>
                Ir al módulo
              </a>
            </Button>
          </div>

          {message ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${isError ? "border-red-200 bg-red-50 text-red-700" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
              {message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <CardHeader>
            <CardTitle>Previsualización</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Filas" value={preview.summary.totalRows} />
              <Stat label="Listas" value={preview.summary.readyRows} />
              <Stat label="Con warning" value={preview.summary.warningRows} />
              <Stat label="Con error" value={preview.summary.errorRows} />
              <Stat label="Crear" value={preview.summary.createRows} />
              <Stat label="Actualizar" value={preview.summary.updateRows} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>Compañía: {preview.masterData.companyName ?? "-"}</p>
              <p>Bodega principal: {preview.masterData.warehouseName ?? "-"}</p>
              <p>Categoría predeterminada: {preview.masterData.itemGroupName ?? "-"}</p>
              <p>Unidad predeterminada: {preview.masterData.uomName ?? "-"}</p>
            </div>

            {blockers.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium">Bloqueos detectados</p>
                {blockers.map((blocker) => (
                  <p key={blocker}>- {blocker}</p>
                ))}
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fila</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                    <th className="px-4 py-3 font-medium">Identificador</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {currentRows.map((row) => (
                    <tr key={`${row.kind}-${row.index}`}>
                      <td className="px-4 py-3">{row.index}</td>
                      <td className="px-4 py-3 uppercase text-slate-600">{row.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.identifier}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            row.status === "error"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : row.status === "warning"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-green-200 bg-green-50 text-green-700"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.errors.map((error) => (
                          <p key={error} className="text-red-700">{error}</p>
                        ))}
                        {row.warnings.map((warning) => (
                          <p key={warning} className="text-amber-700">{warning}</p>
                        ))}
                        {row.errors.length === 0 && row.warnings.length === 0 ? <p>Lista para importar.</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <CardHeader>
            <CardTitle>Resultado de la importación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>Creados: {result.created}</p>
            <p>Actualizados: {result.updated}</p>
            <p>Fallidos: {result.failed}</p>
            <p>Omitidos: {result.skipped}</p>
            {result.errors.length > 0 ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="mb-2 flex items-center gap-2 font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Errores
                </p>
                {result.errors.map((error) => (
                  <p key={error} className="text-xs text-red-700">{error}</p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm shadow-slate-200/60">
        <CardHeader>
          <CardTitle>Historial reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no hay importaciones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Fecha</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Filas</th>
                    <th className="py-2 pr-4 font-medium">Creados</th>
                    <th className="py-2 pr-4 font-medium">Actualizados</th>
                    <th className="py-2 font-medium">Fallidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-4">{new Date(entry.createdAt).toLocaleString("es-EC")}</td>
                      <td className="py-2 pr-4">{entry.type}</td>
                      <td className="py-2 pr-4">{entry.totalRows}</td>
                      <td className="py-2 pr-4">{entry.created}</td>
                      <td className="py-2 pr-4">{entry.updated}</td>
                      <td className="py-2">{entry.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
