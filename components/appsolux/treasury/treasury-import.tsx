"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, Notice, value, type Row, apiPost } from "./ui";

type Preview = {
  rows: Record<string, string>[];
  errors: { row: number; message: string }[];
  warnings?: { row: number; message: string }[];
  valid: boolean;
};
export function TreasuryImport({
  kind,
  reconciliationId,
  onDone,
}: {
  kind: "obligations" | "statement";
  reconciliationId?: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null),
    [page, setPage] = useState(1);
  const columns =
    kind === "obligations"
      ? [
          "tipo",
          "identificacion",
          "nombre",
          "numero_documento",
          "fecha_emision",
          "fecha_vencimiento",
          "valor_original",
          "saldo_pendiente",
          "observacion",
        ]
      : ["fecha", "descripcion", "referencia", "monto", "direccion"];
  const base =
    kind === "obligations" ? "obligations/import" : "banks/statements";
  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const body = new FormData();
      body.append("file", file);
      if (reconciliationId) body.append("reconciliationId", reconciliationId);
      const res = await fetch(`/api/treasury/${base}/preview`, {
        method: "POST",
        body,
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error ?? "No se pudo leer el archivo.");
      setPreview(result);
      setPage(1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error de conexión.");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview?.valid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost(`${base}/confirm`, {
        rows: preview.rows,
        reconciliationId,
      });
      setMessage(
        `${result.imported} registros importados; ${result.skipped} duplicados omitidos.`,
      );
      setPreview(null);
      onDone();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo importar.");
    } finally {
      setBusy(false);
    }
  }
  function template() {
    const content =
      kind === "obligations"
        ? `${columns.join(",")}\nRECEIVABLE,1790012345001,Cliente existente,DOC-001,2026-10-01,2026-10-31,100.00,80.00,Saldo inicial\n`
        : `${columns.join(",")}\n2026-10-01,Deposito,REF-001,100.00,IN\n`;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      kind === "obligations"
        ? "plantilla_obligaciones.csv"
        : "plantilla_estado_bancario.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="space-y-4 rounded-xl border bg-background p-4">
      <h2 className="font-semibold">
        {kind === "obligations"
          ? "Importar obligaciones iniciales"
          : "Importar estado de cuenta"}
      </h2>
      <p className="text-sm text-muted-foreground">
        CSV o XLSX, máximo 4 MB y 1000 registros. Fechas AAAA-MM-DD, dinero con
        punto decimal. El preview no guarda datos.
      </p>
      <p className="break-words text-xs text-muted-foreground">
        Columnas: {columns.join(", ")}
      </p>
      {kind === "obligations" && (
        <Notice>
          Solo crea saldos iniciales de cartera. Los terceros deben existir en
          esta empresa; no crea facturas, compras, movimientos bancarios ni
          inventario.
        </Notice>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-sm">
          Archivo
          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </label>
        <Button disabled={busy || !file} onClick={upload}>
          Validar y previsualizar
        </Button>
        <Button variant="outline" onClick={template}>
          Descargar plantilla CSV
        </Button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {preview && (
        <>
          <div className="space-y-1">
            {preview.errors.map((e, index) => (
              <p key={`${e.row}-${index}`} className="text-sm text-red-700">
                Fila {e.row}: {e.message}
              </p>
            ))}
            {preview.warnings?.map((w, index) => (
              <p key={`${w.row}-${index}`} className="text-sm text-amber-800">
                Fila {w.row}: {w.message}
              </p>
            ))}
          </div>
          <DataTable
            page={page}
            setPage={setPage}
            data={{
              items: preview.rows
                .slice((page - 1) * 25, page * 25)
                .map(
                  (row, index) =>
                    ({ ...row, id: String((page - 1) * 25 + index) }) as Row,
                ),
              total: preview.rows.length,
              page,
              pageSize: 25,
              totalPages: Math.ceil(preview.rows.length / 25),
            }}
            columns={columns.map((column) => ({
              label: column,
              render: (row) => value(row, column),
            }))}
          />
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={busy || !preview.valid}
            onClick={confirm}
          >
            Confirmar importación
          </Button>
        </>
      )}
    </section>
  );
}
