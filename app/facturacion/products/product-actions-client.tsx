"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductImportPreviewResult, ProductImportPreviewRow } from "@/lib/core/product-import";
import { PRODUCT_IMPORT_URLS, previewProductImport, canConfirmProductImport, confirmProductImportPreview, toggleProductImportRow } from "@/lib/client/product-import";

type PriceChange = { id: string; name: string; oldPrice: string; newPrice: string };
type ExportScope = "all" | "filtered" | "selected";
type Props = { selected: string[]; q: string; type: string };

async function request(url: string, body?: unknown) {
  const response = await fetch(url, body instanceof FormData ? { method: "POST", body } : body !== undefined ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message ?? result.error ?? `La solicitud falló (HTTP ${response.status}).`);
  }
  return response;
}

export function ProductActionsClient({ selected, q, type }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"import" | "prices" | null>(null);
  const [preview, setPreview] = useState<ProductImportPreviewResult | null>(null);
  const [changes, setChanges] = useState<PriceChange[] | null>(null);
  const [scope, setScope] = useState("filtered");
  const [channel, setChannel] = useState("price");
  const [method, setMethod] = useState("increase_percent");
  const [value, setValue] = useState("0");
  const [exportPanel, setExportPanel] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>("all");

  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    try { await operation(); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo completar la operación."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const download = (url: string, filename: string) => run(async () => {
    const response = await request(url);
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  });

  return <>
    <Button size="sm" variant="outline" onClick={() => { setPanel("prices"); setChanges(null); setScope(selected.length ? "selected" : "filtered"); }}>Actualizar precios</Button>
    <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>Importar</Button>
    <input ref={fileInput} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Archivo de productos CSV o XLSX" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      setPanel("import"); setPreview(null);
      void run(async () => { setPreview(await previewProductImport(file)); });
    }} />
    <Button asChild size="sm" variant="outline"><a href={PRODUCT_IMPORT_URLS.template} download="productos.xlsx" onClick={(event) => { event.preventDefault(); void download(PRODUCT_IMPORT_URLS.template, "productos.xlsx"); }}>Descargar formato</a></Button>
    <Button size="sm" variant="outline" onClick={() => router.push(type === "COMBO" ? "/facturacion/products" : "/facturacion/products?type=COMBO")}>{type === "COMBO" ? "Ver todos los productos" : "Combos"}</Button>
    <span title={selected.length === 0 ? "Selecciona al menos un producto." : undefined}>
      <Button size="sm" variant="outline" disabled={selected.length === 0} onClick={() => void download(`/api/inventory/products/barcodes?${new URLSearchParams({ ids: selected.join(",") })}`, "codigos-de-barras.pdf")}>Imprimir códigos de barras</Button>
    </span>
    <Button size="sm" variant="outline" onClick={() => { setExportPanel(true); setExportScope(selected.length ? "selected" : "all"); }}>Exportar</Button>
    {busy && <p className="w-full text-sm" role="status">Procesando...</p>}
    {error && <p className="w-full rounded border border-red-300 p-3 text-red-800" role="alert">{error}</p>}
    {message && <p className="w-full rounded border border-green-300 p-3 text-green-800" role="status">{message}</p>}
    {panel && <section aria-label={panel === "import" ? "Importar productos" : "Actualizar precios"} className="w-full rounded-md border bg-card p-4 space-y-3">
      <div className="flex justify-between items-center"><h2 className="font-semibold">{panel === "import" ? "Vista previa de importación" : "Actualizar precios"}</h2><Button size="sm" variant="ghost" disabled={busy} onClick={() => setPanel(null)}>Cerrar</Button></div>
      {panel === "import" && preview && <ProductImportPreview
        preview={preview}
        busy={busy}
        onToggle={(index) => setPreview((current) => current ? { ...current, rows: current.rows.map((row, i) => i === index ? toggleProductImportRow(row) : row) } : current)}
        onConfirm={() => void run(async () => {
          const result = await confirmProductImportPreview(preview.rows, setPreview);
          setPreview(null); setPanel(null); setMessage(`${result.imported} productos importados correctamente.`); router.refresh();
        })}
      />}
      {panel === "prices" && <>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">Aplicar a<select className="block rounded border p-2" value={scope} onChange={(e) => { setScope(e.target.value); setChanges(null); }}>
            {selected.length > 0 && <option value="selected">{selected.length} seleccionados</option>}<option value="filtered">Todos los filtrados</option><option value="all">Todos los productos</option>
          </select></label>
          <label className="text-sm">Precio<select className="block rounded border p-2" value={channel} onChange={(e) => { setChannel(e.target.value); setChanges(null); }}>
            {["Público", "Distribuidor", "Mayorista", "Tarjeta"].map((label, index) => <option key={label} value={index ? `price${index + 1}` : "price"}>{label}</option>)}
          </select></label>
          <label className="text-sm">Método<select className="block rounded border p-2" value={method} onChange={(e) => { setMethod(e.target.value); setChanges(null); }}>
            <option value="increase_percent">Aumentar %</option><option value="decrease_percent">Reducir %</option><option value="increase_value">Aumentar valor</option><option value="decrease_value">Reducir valor</option><option value="cost_plus_margin">Costo + ganancia %</option>
          </select></label>
          <label className="text-sm">Valor<Input type="number" min="0" step="0.01" value={value} onChange={(e) => { setValue(e.target.value); setChanges(null); }} /></label>
        </div>
        <Button disabled={busy} onClick={() => void run(async () => {
          setChanges(await (await request("/api/inventory/products/update-prices", { action: "preview", channel, method, value,
            ...(scope === "selected" ? { productIds: selected } : scope === "filtered" ? { filters: { q, type } } : {}),
          })).json());
        })}>Vista previa de precios</Button>
        {changes && <><p>{changes.length} productos; los precios se guardarán al confirmar.</p><div className="max-h-72 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Producto</th><th>Actual</th><th>Nuevo</th></tr></thead><tbody>{changes.map((c) => <tr key={c.id}><td>{c.name}</td><td className="text-center">{c.oldPrice}</td><td className="text-center">{c.newPrice}</td></tr>)}</tbody></table></div>
          <Button disabled={busy || !changes.length} onClick={() => void run(async () => {
            await request("/api/inventory/products/update-prices", { action: "confirm", channel, changes: changes.map((c) => ({ productId: c.id, oldPrice: c.oldPrice, newPrice: c.newPrice })) });
            setChanges(null); setPanel(null); setMessage("Precios actualizados correctamente."); router.refresh();
          })}>Confirmar precios</Button></>}
      </>}
    </section>}
    {exportPanel && <section aria-label="Exportar productos" className="w-full rounded-md border bg-card p-4 space-y-3">
      <div className="flex justify-between items-center"><h2 className="font-semibold">Exportar productos</h2><Button size="sm" variant="ghost" disabled={busy} onClick={() => setExportPanel(false)}>Cerrar</Button></div>
      <div className="space-y-2">
        <label className="text-sm">Alcance<select className="block rounded border p-2 mt-1" value={exportScope} onChange={(e) => setExportScope(e.target.value as ExportScope)}>
          <option value="all">Todos los productos</option>
          <option value="filtered">Productos filtrados</option>
          <option value="selected" disabled={selected.length === 0}>Productos seleccionados ({selected.length})</option>
        </select></label>
        <p className="text-sm text-muted-foreground">Formato: Excel (.xlsx) compatible con Importar productos.</p>
      </div>
      <Button disabled={busy} onClick={() => {
        const params = new URLSearchParams({ scope: exportScope });
        if (exportScope === "filtered") { if (q) params.set("q", q); if (type) params.set("type", type); }
        if (exportScope === "selected") params.set("ids", selected.join(","));
        const today = new Date().toISOString().slice(0, 10);
        void download(`/api/inventory/products/export?${params}`, `facturom-productos-${today}.xlsx`);
      }}>Exportar</Button>
    </section>}
  </>;
}

const IMPORT_STATUS_LABELS: Record<ProductImportPreviewRow["status"], string> = {
  READY: "Listo", SKIP_EXISTING: "Ya existe", SKIP_DUPLICATE_FILE: "Duplicado en archivo",
  NEEDS_REVIEW: "Requiere revisión", EXCLUDED: "Excluido",
};

export function ProductImportPreview({ preview, busy, onToggle, onConfirm }: {
  preview: ProductImportPreviewResult;
  busy: boolean;
  onToggle: (index: number) => void;
  onConfirm: () => void;
}) {
  const selected = preview.rows.filter((row) => row.selectedForImport);
  return <>
    <p>{selected.filter((row) => row.status === "READY").length} filas listas seleccionadas; {selected.filter((row) => row.status === "NEEDS_REVIEW").length} requieren revisión. La vista previa no guarda productos.</p>
    <p className="text-sm text-muted-foreground">Puedes excluir filas con errores. Los servicios y combos virtuales no tienen inventario propio.</p>
    <div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr>
      {["Incluir", "Fila", "Tipo", "Código", "Nombre", "IVA", "PVP público", "Stock inicial", "Controlar inventario", "Estado", "Errores"].map((label) => <th key={label} scope="col" className="px-2 py-1 text-left">{label}</th>)}
    </tr></thead><tbody>{preview.rows.map((row, index) => {
      const tracksStock = row.data.tipo === "SERVICIO" || row.data.tipo === "SERVICE" || row.data.tipo === "COMBO" ? "false" : row.data.controlar_inventario || "true";
      return <tr key={row.rowNumber} className={row.status === "EXCLUDED" ? "text-muted-foreground" : undefined}>
        <td className="px-2"><input type="checkbox" aria-label={`Incluir fila ${row.rowNumber}`} checked={row.selectedForImport} disabled={busy || row.status === "SKIP_EXISTING" || row.status === "SKIP_DUPLICATE_FILE"} onChange={() => onToggle(index)} /></td>
        <td>{row.rowNumber}</td><td>{row.data.tipo}</td><td>{row.data.codigo}</td><td>{row.data.nombre}</td><td>{row.data.iva}</td><td>{row.data.pvp_publico || "0"}</td><td>{row.data.stock_inicial || "0"}</td><td>{tracksStock}</td>
        <td className="px-2">{IMPORT_STATUS_LABELS[row.status]} ({row.status})</td>
        <td className="min-w-48 text-red-700">{row.issues.map((issue, i) => <p key={`${issue.field}-${i}`}>{issue.field}: {issue.message}</p>)}</td>
      </tr>;
    })}</tbody></table></div>
    <Button disabled={busy || !canConfirmProductImport(preview.rows)} onClick={onConfirm}>Confirmar importación</Button>
  </>;
}
