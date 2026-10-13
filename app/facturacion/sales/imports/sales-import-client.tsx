"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  FileSpreadsheet,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Types ────────────────────────────────────────────────────────────────────

type PreviewRow = {
  row: number;
  externalRef: string;
  customerName: string;
  productCode: string;
  date: string;
  total: string;
  status: "VALID" | "WARNING" | "ERROR";
  messages: string[];
};

type Preview = {
  rows: PreviewRow[];
  salesDetected: number;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  totalAmount: number;
  hasBlockingErrors: boolean;
};

type BatchRow = {
  id: string;
  fileName: string;
  sourceType: string;
  status: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  importedSales: number;
  totalAmount: string;
  createdAt: string;
  completedAt: string | null;
  createdByName: string;
};

type Step = "upload" | "preview" | "result";

// ── Helpers ──────────────────────────────────────────────────────────────────

function money(value: number | string) {
  return `$${Number(value).toFixed(2)}`;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  UPLOADED: { label: "Subido", className: "bg-blue-50 text-blue-700" },
  VALIDATED: { label: "Validado", className: "bg-blue-50 text-blue-700" },
  PROCESSING: { label: "Procesando", className: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Completado", className: "bg-emerald-50 text-emerald-700" },
  PARTIAL: { label: "Parcial", className: "bg-amber-50 text-amber-700" },
  FAILED: { label: "Fallido", className: "bg-red-50 text-red-700" },
};

// ── Component ────────────────────────────────────────────────────────────────

export function SalesImportClient() {
  const [activeTab, setActiveTab] = useState<"import" | "history">("import");
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    totalAmount: number;
  } | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await fetch("/api/sales-import/batches");
      const data = await res.json();
      if (data.ok) setBatches(data.batches);
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") fetchBatches();
  }, [activeTab, fetchBatches]);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/sales-import/preview", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        setPreview(data.preview);
        setStep("preview");
      } else {
        alert(data.error ?? "Error al procesar el archivo.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/sales-import/confirm", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
        setStep("result");
      } else {
        alert(data.error ?? "Error al importar.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBatch(batchId: string) {
    if (!confirm("¿Eliminar esta importación? Se borrarán todas las ventas importadas en este lote.")) {
      return;
    }
    const res = await fetch(`/api/sales-import/batches/${batchId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.ok) {
      fetchBatches();
    } else {
      alert(data.error ?? "Error al eliminar.");
    }
  }

  function resetImport() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          Importar ventas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Trae ventas históricas desde otro sistema sin volver a emitirlas al SRI.
        </p>
      </header>

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Las ventas importadas son históricas. No se enviarán al SRI ni
          modificarán el stock actual.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "import"
              ? "border-b-2 border-facturom-primary text-facturom-primary"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("import")}
        >
          Importar
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "border-b-2 border-facturom-primary text-facturom-primary"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("history")}
        >
          Historial
        </button>
      </div>

      {activeTab === "import" && (
        <>
          {/* Step 1: Upload */}
          {step === "upload" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-5 w-5" />
                  Subir archivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/api/sales-import/template" download>
                      <Download className="mr-1 h-4 w-4" />
                      Descargar plantilla
                    </a>
                  </Button>
                </div>

                <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">
                    CSV o XLSX
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx"
                    className="mt-3"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="bg-facturom-primary hover:bg-facturom-primary-soft"
                >
                  {loading ? "Procesando..." : "Previsualizar"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniCard
                  label="Ventas detectadas"
                  value={String(preview.salesDetected)}
                />
                <MiniCard label="Filas" value={String(preview.totalRows)} />
                <MiniCard
                  label="Válidas"
                  value={String(preview.validRows)}
                  tone="success"
                />
                <MiniCard
                  label="Con errores"
                  value={String(preview.errorRows)}
                  tone={preview.errorRows > 0 ? "error" : undefined}
                />
              </div>

              {preview.warningRows > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  {preview.warningRows} fila(s) con advertencia (duplicadas — se
                  omitirán).
                </div>
              )}

              <p className="text-sm text-slate-600">
                Total acumulado:{" "}
                <span className="font-semibold">{money(preview.totalAmount)}</span>
              </p>

              {/* Preview table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Fila</th>
                          <th className="px-3 py-2">Venta ext.</th>
                          <th className="px-3 py-2">Cliente</th>
                          <th className="px-3 py-2">Producto</th>
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Mensaje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r) => (
                          <tr
                            key={r.row}
                            className="border-b last:border-0 hover:bg-slate-50/50"
                          >
                            <td className="px-3 py-2 font-mono text-xs text-slate-400">
                              {r.row}
                            </td>
                            <td className="px-3 py-2 font-medium">{r.externalRef}</td>
                            <td className="px-3 py-2">{r.customerName}</td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {r.productCode}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {money(r.total)}
                            </td>
                            <td className="px-3 py-2">
                              <StatusIcon status={r.status} />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {r.messages.join(" ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={resetImport}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={preview.hasBlockingErrors || loading}
                  className="bg-facturom-primary hover:bg-facturom-primary-soft"
                >
                  {loading
                    ? "Importando..."
                    : `Confirmar importación (${preview.validRows + preview.warningRows} filas)`}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === "result" && result && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      Importación completada
                    </p>
                    <p className="text-sm text-slate-600">
                      {result.imported} ventas importadas · {result.skipped}{" "}
                      omitidas (duplicadas) · Total: {money(result.totalAmount)}
                    </p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-800">
                      Errores ({result.errors.length}):
                    </p>
                    <ul className="mt-1 list-inside list-disc text-xs text-red-700">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button onClick={resetImport} variant="outline">
                  Importar otro archivo
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* History tab */}
      {activeTab === "history" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Archivo</th>
                    <th className="px-4 py-3 text-right">Ventas</th>
                    <th className="px-4 py-3 text-right">Errores</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {batchesLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        Cargando...
                      </td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        No hay importaciones registradas.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b, idx) => {
                      const badge = statusBadge[b.status] ?? {
                        label: b.status,
                        className: "bg-slate-50 text-slate-700",
                      };
                      return (
                        <tr
                          key={b.id}
                          className="border-b last:border-0 hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {new Date(b.createdAt).toLocaleDateString("es-EC", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 font-medium">{b.fileName}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {b.importedSales}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-600">
                            {b.errorRows}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {money(b.totalAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {b.createdByName}
                          </td>
                          <td className="px-4 py-3">
                            {(b.status === "COMPLETED" || b.status === "PARTIAL") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteBatch(b.id)}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Eliminar
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function MiniCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "error";
}) {
  const color =
    tone === "success"
      ? "text-emerald-700"
      : tone === "error"
        ? "text-red-700"
        : "text-slate-900";
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: "VALID" | "WARNING" | "ERROR" }) {
  if (status === "VALID")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Válido
      </span>
    );
  if (status === "WARNING")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <Clock className="h-3.5 w-3.5" /> Advertencia
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
      <XCircle className="h-3.5 w-3.5" /> Error
    </span>
  );
}
