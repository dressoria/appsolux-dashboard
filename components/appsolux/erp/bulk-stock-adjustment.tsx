"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ErpnextItem, ErpnextWarehouse } from "@/types/erpnext";

type Props = {
  items: ErpnextItem[];
  warehouses: ErpnextWarehouse[];
};

type ParsedRow = {
  item_code: string;
  warehouse: string;
  qty: number;
  reason: string;
  errors: string[];
};

type ApplyResult = {
  item_code: string;
  warehouse: string;
  status: "ok" | "error";
  document_name?: string | null;
  error?: string;
};

const CSV_HEADERS = ["item_code", "warehouse", "qty", "reason"];
const TEMPLATE_EXAMPLE = `item_code,warehouse,qty,reason\nPROD-001,Main Warehouse - Company,10,Conteo fisico\n`;

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export function BulkStockAdjustment({ items, warehouses }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [applyResults, setApplyResults] = useState<ApplyResult[] | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const itemCodes = new Set(items.map((i) => i.item_code));
  const warehouseNames = new Set(
    warehouses.filter((w) => w.is_group !== 1 && w.disabled !== 1).map((w) => w.name)
  );

  function handleDownloadTemplate() {
    downloadCSV(TEMPLATE_EXAMPLE, "plantilla_ajuste_inventario.csv");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setRows(null);
    setApplyResults(null);
    setApplyMessage(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") return;

      const lines = parseCSV(text).filter((l) => l.some((c) => c !== ""));
      if (lines.length < 2) {
        setParseError("El archivo no contiene filas de datos.");
        return;
      }

      const headers = lines[0].map((h) => h.toLowerCase());
      const missingHeaders = CSV_HEADERS.filter((h) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        setParseError(`Faltan columnas: ${missingHeaders.join(", ")}`);
        return;
      }

      const idxItem = headers.indexOf("item_code");
      const idxWarehouse = headers.indexOf("warehouse");
      const idxQty = headers.indexOf("qty");
      const idxReason = headers.indexOf("reason");

      const parsed: ParsedRow[] = lines.slice(1).map((cols) => {
        const item_code = cols[idxItem] ?? "";
        const warehouse = cols[idxWarehouse] ?? "";
        const qtyRaw = cols[idxQty] ?? "";
        const reason = cols[idxReason] ?? "Ajuste masivo CSV";
        const qty = parseFloat(qtyRaw);

        const errors: string[] = [];
        if (!item_code) errors.push("item_code vacio");
        else if (!itemCodes.has(item_code)) errors.push(`Producto no existe: ${item_code}`);
        if (!warehouse) errors.push("warehouse vacio");
        else if (!warehouseNames.has(warehouse)) errors.push(`Bodega no encontrada: ${warehouse}`);
        if (isNaN(qty)) errors.push("qty no es un numero");
        else if (qty < 0) errors.push("qty no puede ser negativo");

        return { item_code, warehouse, qty: isNaN(qty) ? 0 : qty, reason, errors };
      });

      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function handleApply() {
    if (!rows) return;
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;

    setIsPending(true);
    setApplyResults(null);
    setApplyMessage(null);
    try {
      const response = await fetch("/api/erpnext/inventory/adjustments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            item_code: r.item_code,
            warehouse: r.warehouse,
            qty: r.qty,
            reason: r.reason,
          })),
        }),
      });
      const result = await response.json() as {
        success: boolean;
        data?: { results: ApplyResult[]; applied: number; errors: number };
        error?: { message: string };
      };

      if (!result.success) {
        setApplyMessage(`Error: ${result.error?.message ?? "Error desconocido"}`);
        return;
      }

      setApplyResults(result.data?.results ?? []);
      const { applied, errors } = result.data ?? { applied: 0, errors: 0 };
      setApplyMessage(
        errors === 0
          ? `${applied} ajuste(s) aplicado(s) correctamente.`
          : `${applied} aplicado(s), ${errors} con error.`
      );
      router.refresh();
    } catch (err) {
      setApplyMessage(err instanceof Error ? err.message : "Error al aplicar ajuste masivo.");
    } finally {
      setIsPending(false);
    }
  }

  const validCount = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const errorCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
          Descargar plantilla CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          Cargar CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Columnas requeridas: <span className="font-medium">item_code, warehouse, qty, reason</span>. La columna reason es opcional en contenido pero debe estar presente en el encabezado.
      </p>

      {parseError ? (
        <p className="text-sm text-destructive">{parseError}</p>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-green-700 font-medium">{validCount} fila(s) valida(s)</span>
            {errorCount > 0 ? (
              <span className="text-destructive font-medium">{errorCount} fila(s) con error</span>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pl-3 pr-2 text-left font-medium">Producto</th>
                  <th className="py-2 pr-2 text-left font-medium">Bodega</th>
                  <th className="py-2 pr-2 text-left font-medium">Qty objetivo</th>
                  <th className="py-2 pr-2 text-left font-medium">Razon</th>
                  <th className="py-2 pr-2 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr key={i} className={row.errors.length > 0 ? "bg-rose-50/40" : ""}>
                    <td className="py-2 pl-3 pr-2 font-mono text-xs">{row.item_code || "-"}</td>
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{row.warehouse || "-"}</td>
                    <td className="py-2 pr-2">{row.qty}</td>
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{row.reason || "-"}</td>
                    <td className="py-2 pr-2">
                      {row.errors.length > 0 ? (
                        <span className="text-xs text-destructive">{row.errors.join("; ")}</span>
                      ) : (
                        <span className="text-xs text-green-700">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validCount > 0 ? (
            <Button type="button" onClick={handleApply} disabled={isPending}>
              {isPending ? "Aplicando..." : `Aplicar ${validCount} ajuste(s)`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {applyMessage ? (
        <p className={applyMessage.startsWith("Error") ? "text-sm text-destructive" : "text-sm text-green-700"}>
          {applyMessage}
        </p>
      ) : null}

      {applyResults && applyResults.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pl-3 pr-2 text-left font-medium">Producto</th>
                <th className="py-2 pr-2 text-left font-medium">Bodega</th>
                <th className="py-2 pr-2 text-left font-medium">Resultado</th>
                <th className="py-2 pr-2 text-left font-medium">Documento</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {applyResults.map((r, i) => (
                <tr key={i}>
                  <td className="py-2 pl-3 pr-2 font-mono text-xs">{r.item_code}</td>
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{r.warehouse}</td>
                  <td className="py-2 pr-2">
                    {r.status === "ok" ? (
                      <span className="text-xs text-green-700">Aplicado</span>
                    ) : (
                      <span className="text-xs text-destructive">{r.error}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">
                    {r.document_name ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
