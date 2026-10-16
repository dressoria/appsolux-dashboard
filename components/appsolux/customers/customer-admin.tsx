"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { Download, Eye, FileSpreadsheet, FileText, Pencil, Plus, Search, Upload, X, Check, AlertTriangle, Ban, MinusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Customer = { id: string; name: string; tradeName: string | null; phone: string | null; email: string | null; address: string | null; identificationType: string | null; identification: string | null; customerOrigin: string | null; province: string | null; city: string | null; isActive: boolean; createdAt: string };
type ImportRowIssue = { field: string; message: string };
type ImportPreviewRow = { rowNumber: number; data: Record<string, string>; status: string; issues: ImportRowIssue[]; selectedForImport: boolean; autofilledFields: string[] };
type ImportPreview = { rows: ImportPreviewRow[]; counts: { ready: number; skipExisting: number; skipDuplicateFile: number; needsReview: number } };
type ImportResult = { ok: boolean; imported: number; skippedExisting: number; skippedDuplicateFile: number; failed: number };

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: typeof Check }> = {
  READY: { label: "Listo", bg: "bg-emerald-50", text: "text-emerald-700", icon: Check },
  SKIP_EXISTING: { label: "Ya existe · no se importará", bg: "bg-slate-100", text: "text-slate-500", icon: Ban },
  SKIP_DUPLICATE_FILE: { label: "Repetido en archivo", bg: "bg-amber-50", text: "text-amber-600", icon: MinusCircle },
  NEEDS_REVIEW: { label: "Requiere corrección", bg: "bg-red-50", text: "text-red-600", icon: AlertTriangle },
  EXCLUDED: { label: "Excluida", bg: "bg-gray-100", text: "text-gray-400", icon: X },
};

const EDITABLE_FIELDS = [
  { key: "identificationType", label: "Tipo", type: "select", options: ["RUC", "CEDULA", "PASSPORT", "FOREIGN_ID"] },
  { key: "identification", label: "Identificación", type: "text" },
  { key: "name", label: "Nombre / Razón social", type: "text" },
  { key: "tradeName", label: "Nombre comercial", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone", label: "Teléfono", type: "text" },
  { key: "address", label: "Dirección", type: "text" },
  { key: "country", label: "País", type: "text" },
  { key: "province", label: "Provincia", type: "text" },
  { key: "city", label: "Ciudad", type: "text" },
] as const;

export function CustomerAdmin({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const revalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => customers.filter((customer) => {
    const needle = query.trim().toLowerCase();
    return (!needle || [customer.name, customer.tradeName, customer.identification, customer.email, customer.phone].some((value) => value?.toLowerCase().includes(needle))) && (!type || customer.identificationType === type) && (!status || customer.isActive === (status === "active")) && (!origin || customer.customerOrigin === origin) && (!province || customer.province === province) && (!city || customer.city === city) && (!date || customer.createdAt.slice(0, 10) === date);
  }), [customers, query, type, status, origin, province, city, date]);

  const exportQuery = new URLSearchParams({ q: query, type, status, origin, province, city, date }).toString();

  async function toggle(customer: Customer) { await fetch(`/api/basic/customers/${customer.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !customer.isActive }) }); router.refresh(); }

  async function previewFile(file: File) {
    setMessage(""); setResult(null); setAccepted(false);
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/basic/customers/import/preview", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message ?? "No se pudo leer el archivo.");
    setPreview(data as ImportPreview);
  }

  const revalidateRows = useCallback(async (rows: ImportPreviewRow[]) => {
    setRevalidating(true);
    try {
      const response = await fetch("/api/basic/customers/import/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const data = await response.json();
      if (response.ok) setPreview(data as ImportPreview);
    } finally {
      setRevalidating(false);
    }
  }, []);

  function scheduleRevalidate(rows: ImportPreviewRow[]) {
    if (revalidateTimer.current) clearTimeout(revalidateTimer.current);
    revalidateTimer.current = setTimeout(() => revalidateRows(rows), 300);
  }

  function updateRowField(index: number, field: string, value: string) {
    if (!preview) return;
    const newRows = preview.rows.map((r, i) => i === index ? { ...r, data: { ...r.data, [field]: value } } : r);
    setPreview({ ...preview, rows: newRows });
    setAccepted(false);
    scheduleRevalidate(newRows);
  }

  function toggleRowSelection(index: number) {
    if (!preview) return;
    const row = preview.rows[index];
    if (row.status === "SKIP_EXISTING" || row.status === "SKIP_DUPLICATE_FILE") return;

    const newRows = preview.rows.map((r, i) => {
      if (i !== index) return r;
      if (r.selectedForImport) {
        return { ...r, selectedForImport: false, status: "EXCLUDED" as string };
      }
      return { ...r, selectedForImport: true, status: r.issues.length > 0 ? "NEEDS_REVIEW" : "READY" };
    });
    const newCounts = {
      ready: newRows.filter((r) => r.status === "READY").length,
      skipExisting: newRows.filter((r) => r.status === "SKIP_EXISTING").length,
      skipDuplicateFile: newRows.filter((r) => r.status === "SKIP_DUPLICATE_FILE").length,
      needsReview: newRows.filter((r) => r.status === "NEEDS_REVIEW").length,
    };
    setPreview({ rows: newRows, counts: newCounts });
    setAccepted(false);
  }

  function selectAllReady() {
    if (!preview) return;
    const newRows = preview.rows.map((r) => {
      if (r.status === "SKIP_EXISTING" || r.status === "SKIP_DUPLICATE_FILE") return r;
      if (r.issues.length > 0) return { ...r, selectedForImport: true, status: "NEEDS_REVIEW" };
      return { ...r, selectedForImport: true, status: "READY" };
    });
    const newCounts = {
      ready: newRows.filter((r) => r.status === "READY").length,
      skipExisting: newRows.filter((r) => r.status === "SKIP_EXISTING").length,
      skipDuplicateFile: newRows.filter((r) => r.status === "SKIP_DUPLICATE_FILE").length,
      needsReview: newRows.filter((r) => r.status === "NEEDS_REVIEW").length,
    };
    setPreview({ rows: newRows, counts: newCounts });
  }

  const selectedReady = preview?.rows.filter((r) => r.selectedForImport && r.status === "READY").length ?? 0;
  const hasSelectedNeedsReview = preview?.rows.some((r) => r.selectedForImport && r.status === "NEEDS_REVIEW") ?? false;
  const canConfirm = accepted && selectedReady > 0 && !hasSelectedNeedsReview && !importing && !revalidating;

  async function confirmImport() {
    if (!preview || !canConfirm) return;
    setImporting(true); setMessage("");
    try {
      const response = await fetch("/api/basic/customers/import/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: preview.rows }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "No se pudo importar."); return; }
      setResult(data as ImportResult);
      setPreview(null);
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  return <div className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold text-[#172033]">Clientes</h1><p className="mt-1 text-sm text-[#667085]">Directorio comercial y tributario</p></div><div className="flex flex-wrap gap-2"><Button asChild className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"><Link href="/facturacion/customers/new"><Plus />Crear cliente</Link></Button><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />Importar</Button><Button asChild variant="outline"><a href="/api/basic/customers/import/template"><Download />Formato</a></Button><input ref={fileRef} className="hidden" type="file" accept=".csv,.xlsx" onChange={(event) => { if (event.target.files?.[0]) previewFile(event.target.files[0]); event.target.value = ""; }} /></div></header>
    <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={`/api/basic/customers/export?format=pdf&${exportQuery}`}><FileText />PDF</a></Button><Button asChild variant="outline"><a href={`/api/basic/customers/export?format=xlsx&${exportQuery}`}><FileSpreadsheet />Excel</a></Button></div>
    <section className="grid gap-2 rounded-xl border border-[#E4E9F0] bg-white p-3 md:grid-cols-4 xl:grid-cols-7"><label className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 size-4 text-[#667085]"/><Input className="pl-9" placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)}/></label><Select label="Tipo identificación" value={type} onChange={setType} options={["RUC","CEDULA","PASSPORT","FOREIGN_ID"]}/><Select label="Estado" value={status} onChange={setStatus} options={["active","inactive"]}/><Select label="Origen" value={origin} onChange={setOrigin} options={unique(customers.map((c) => c.customerOrigin))}/><Select label="Provincia" value={province} onChange={setProvince} options={unique(customers.map((c) => c.province))}/><Select label="Ciudad" value={city} onChange={setCity} options={unique(customers.filter((c) => !province || c.province === province).map((c) => c.city))}/><Input type="date" aria-label="Fecha de registro" value={date} onChange={(e) => setDate(e.target.value)}/></section>
    {message ? <p className="text-sm text-[#667085]">{message}</p> : null}
    {result ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="font-medium">{result.imported} cliente(s) importado(s) correctamente.</p>{result.skippedExisting > 0 && <p>{result.skippedExisting} cliente(s) existente(s) omitido(s).</p>}{result.skippedDuplicateFile > 0 && <p>{result.skippedDuplicateFile} duplicado(s) en archivo omitido(s).</p>}<Button variant="outline" size="sm" className="mt-2" onClick={() => setResult(null)}>Cerrar</Button></div> : null}
    <div className="overflow-hidden rounded-xl border border-[#E4E9F0] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1550px] text-left text-xs"><thead className="bg-[#F6F8FB] text-[#667085]"><tr>{["#","Tipo","Identificación","Razón social / Nombre","Nombre comercial","Origen","Email principal","Teléfono principal","Dirección","Provincia","Ciudad","Registro","Estado","Acciones"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#E4E9F0]">{filtered.map((customer, index) => <tr key={customer.id} className="hover:bg-[#F8FAFD]"><td className="px-3 py-3">{index + 1}</td><td className="px-3">{customer.identificationType ?? "—"}</td><td className="px-3 font-medium">{customer.identification ?? "—"}</td><td className="px-3 font-medium text-[#172033]">{customer.name}</td><td className="px-3">{customer.tradeName ?? "—"}</td><td className="px-3">{customer.customerOrigin ?? "—"}</td><td className="px-3">{customer.email ?? "—"}</td><td className="px-3">{customer.phone ?? "—"}</td><td className="max-w-48 truncate px-3">{customer.address ?? "—"}</td><td className="px-3">{customer.province ?? "—"}</td><td className="px-3">{customer.city ?? "—"}</td><td className="px-3">{new Intl.DateTimeFormat("es-EC").format(new Date(customer.createdAt))}</td><td className="px-3"><span className={customer.isActive ? "text-emerald-700" : "text-[#667085]"}>{customer.isActive ? "Activo" : "Inactivo"}</span></td><td className="px-3"><div className="flex gap-1"><Button asChild size="icon-sm" variant="ghost"><Link href={`/facturacion/customers/${customer.id}`} aria-label="Ver cliente"><Eye/></Link></Button><Button asChild size="icon-sm" variant="ghost"><Link href={`/facturacion/customers/${customer.id}?edit=1`} aria-label="Editar cliente"><Pencil/></Link></Button><Button size="sm" variant="ghost" onClick={() => toggle(customer)}>{customer.isActive ? "Desactivar" : "Activar"}</Button></div></td></tr>)}</tbody></table></div>{!filtered.length ? <p className="p-8 text-center text-sm text-[#667085]">No hay clientes que coincidan con los filtros.</p> : null}</div>

    {preview ? <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div className="w-full max-w-[1400px] rounded-xl bg-white p-5 shadow-xl my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Previsualizar importación</h2>
          <Button variant="ghost" size="icon-sm" onClick={() => { setPreview(null); setAccepted(false); }}><X /></Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700">Listos para importar<br/><strong>{preview.counts.ready}</strong></div>
          <div className="rounded-lg bg-slate-100 p-3 text-slate-500">Se omitirán (existentes)<br/><strong>{preview.counts.skipExisting}</strong></div>
          <div className="rounded-lg bg-amber-50 p-3 text-amber-600">Duplicados en archivo<br/><strong>{preview.counts.skipDuplicateFile}</strong></div>
          <div className="rounded-lg bg-red-50 p-3 text-red-600">Requieren corrección<br/><strong>{preview.counts.needsReview}</strong></div>
        </div>

        {revalidating && <p className="mt-2 text-xs text-[#667085] animate-pulse">Revalidando...</p>}

        <div className="mt-4 overflow-x-auto max-h-[60vh] overflow-y-auto border rounded-lg">
          <table className="w-full min-w-[1300px] text-left text-xs">
            <thead className="bg-[#F6F8FB] text-[#667085] sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 font-medium"><input type="checkbox" onChange={selectAllReady} title="Seleccionar todas" /></th>
                <th className="px-2 py-2 font-medium">Fila</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                {EDITABLE_FIELDS.map((f) => <th key={f.key} className="px-2 py-2 font-medium">{f.label}</th>)}
                <th className="px-2 py-2 font-medium">Observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E9F0]">
              {preview.rows.map((row, idx) => {
                const config = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.READY;
                const Icon = config.icon;
                const isEditable = row.status !== "SKIP_EXISTING" && row.status !== "SKIP_DUPLICATE_FILE";
                const isCheckDisabled = row.status === "SKIP_EXISTING" || row.status === "SKIP_DUPLICATE_FILE";
                const fieldIssues = new Map(row.issues.map((i) => [i.field, i.message]));

                return <tr key={idx} className={`${config.bg} hover:brightness-95`}>
                  <td className="px-2 py-1.5"><input type="checkbox" checked={row.selectedForImport} disabled={isCheckDisabled} onChange={() => toggleRowSelection(idx)} /></td>
                  <td className="px-2 py-1.5 font-medium">{row.rowNumber}</td>
                  <td className="px-2 py-1.5"><span className={`inline-flex items-center gap-1 text-xs ${config.text}`}><Icon className="size-3" />{config.label}</span></td>
                  {EDITABLE_FIELDS.map((f) => {
                    const hasIssue = fieldIssues.has(f.key);
                    const isAutofilled = row.autofilledFields.includes(f.key);
                    const cellClass = hasIssue ? "border-red-400 bg-red-50" : isAutofilled ? "border-blue-300 bg-blue-50/50" : "border-[#E4E9F0]";

                    if (!isEditable) return <td key={f.key} className="px-2 py-1.5 text-gray-400">{row.data[f.key] || "—"}</td>;

                    if (f.type === "select") return <td key={f.key} className="px-2 py-1.5">
                      <select value={row.data[f.key] || ""} onChange={(e) => updateRowField(idx, f.key, e.target.value)} className={`h-6 w-full rounded border px-1 text-xs ${cellClass}`} title={hasIssue ? fieldIssues.get(f.key) : undefined}>
                        <option value="">—</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>;

                    return <td key={f.key} className="px-2 py-1.5">
                      <div className="relative">
                        <input type="text" value={row.data[f.key] || ""} onChange={(e) => updateRowField(idx, f.key, e.target.value)} className={`h-6 w-full rounded border px-1 text-xs ${cellClass}`} title={hasIssue ? fieldIssues.get(f.key) : isAutofilled ? "Autocompletado" : undefined} />
                        {isAutofilled && !hasIssue && <span className="absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full bg-blue-400 text-[6px] text-white" title="Autocompletado">A</span>}
                      </div>
                    </td>;
                  })}
                  <td className="px-2 py-1.5 text-xs max-w-48">
                    {row.issues.length > 0 ? <span className="text-red-600">{row.issues.map((i) => i.message).join(" · ")}</span> : row.status === "SKIP_EXISTING" ? <span className="text-slate-500">Ya existe · no se importará</span> : row.status === "SKIP_DUPLICATE_FILE" ? <span className="text-amber-600">Identificación repetida dentro del archivo</span> : null}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
            <span>He revisado la previsualización y confirmo que deseo importar los clientes seleccionados.</span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setPreview(null); setAccepted(false); }}>Cancelar</Button>
            <Button disabled={!canConfirm} onClick={confirmImport} className="bg-[#1E52F1] text-white hover:bg-[#1745CE]">
              {importing ? "Importando..." : `Importar ${selectedReady} cliente(s)`}
            </Button>
          </div>
        </div>
      </div>
    </div> : null}
  </div>;
}
function unique(values: Array<string | null>) { return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(); }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"><option value="">{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
