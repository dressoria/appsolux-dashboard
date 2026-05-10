"use client";

import { Button } from "@/components/ui/button";

type CsvColumn<TRow extends object> = {
  key: Extract<keyof TRow, string>;
  header: string;
};

type ExportCsvButtonProps<TRow extends object> = {
  filename: string;
  columns: CsvColumn<TRow>[];
  rows: TRow[];
  size?: "xs" | "sm" | "default";
};

function sanitizeFilename(filename: string) {
  const base = filename
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "reporte"}.csv`;
}

function escapeCsvValue(value: unknown) {
  const text =
    value === null || typeof value === "undefined" ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

export function ExportCsvButton<TRow extends object>({
  filename,
  columns,
  rows,
  size = "sm",
}: ExportCsvButtonProps<TRow>) {
  function handleExport() {
    const header = columns.map((column) => escapeCsvValue(column.header));
    const body = rows.map((row) =>
      columns.map((column) => escapeCsvValue(row[column.key]))
    );
    const csv = [header, ...body].map((line) => line.join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = sanitizeFilename(filename);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={handleExport}
      disabled={rows.length === 0}
    >
      Exportar CSV
    </Button>
  );
}
