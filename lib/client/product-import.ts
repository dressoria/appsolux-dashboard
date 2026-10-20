import type { ProductImportPreviewResult, ProductImportPreviewRow } from "@/lib/core/product-import";

export const PRODUCT_IMPORT_URLS = {
  template: "/api/inventory/products/import/template?v=2",
  preview: "/api/inventory/products/import/preview",
  validate: "/api/inventory/products/import/validate",
  confirm: "/api/inventory/products/import/confirm",
} as const;

async function post<T>(url: string, body: FormData | { rows: ProductImportPreviewRow[] }): Promise<T> {
  const response = await fetch(url, body instanceof FormData ? { method: "POST", body } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? result.error ?? "No se pudo importar el archivo.");
  return result as T;
}

export function previewProductImport(file: File) {
  const body = new FormData(); body.append("file", file);
  return post<ProductImportPreviewResult>(PRODUCT_IMPORT_URLS.preview, body);
}

export function canConfirmProductImport(rows: ProductImportPreviewRow[]): boolean {
  const selected = rows.filter((row) => row.selectedForImport);
  return selected.length > 0 && selected.every((row) => row.status === "READY" && row.issues.length === 0);
}

export function toggleProductImportRow(row: ProductImportPreviewRow): ProductImportPreviewRow {
  if (row.status === "SKIP_EXISTING" || row.status === "SKIP_DUPLICATE_FILE") return row;
  const selectedForImport = !row.selectedForImport;
  return { ...row, selectedForImport, status: selectedForImport ? (row.issues.length ? "NEEDS_REVIEW" : "READY") : "EXCLUDED" };
}

export async function confirmProductImportPreview(
  rows: ProductImportPreviewRow[],
  onValidated: (result: ProductImportPreviewResult) => void,
) {
  const validated = await post<ProductImportPreviewResult>(PRODUCT_IMPORT_URLS.validate, { rows });
  onValidated(validated);
  if (!canConfirmProductImport(validated.rows)) throw new Error("Revisa los errores o excluye las filas inválidas antes de confirmar.");
  return post<{ imported: number; skippedExisting: number; skippedDuplicateFile: number }>(PRODUCT_IMPORT_URLS.confirm, { rows: validated.rows });
}
