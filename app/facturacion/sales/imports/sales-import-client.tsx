"use client";

import Link from "next/link";
import { SyncProgressCard } from "@/components/appsolux/sri-tax/sync-progress-card";
import { useSyncJobs } from "@/components/appsolux/sri-tax/use-sync-jobs";
import { connectionLabel } from "@/lib/core/sri-sync-presentation";
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
  Search,
  Key,
  ChevronDown,
  Copy,
  RefreshCw,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────────────────────────────────

type ConsolidatedItem = {
  id: string;
  source: string;
  documentType: string;
  documentNumber: string | null;
  accessKey: string | null;
  issueDate: string | null;
  customerName: string | null;
  customerIdentification: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: string;
};

type Totals = {
  totalSales: number;
  totalAmount: number;
  facturomCount: number;
  facturomAmount: number;
  externalCount: number;
  externalAmount: number;
};

type DocumentPreview = {
  serie: string;
  documentType: string;
  accessKey: string | null;
  issueDate: string;
  customerName: string;
  customerIdentification: string;
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  status: "VALID" | "WARNING" | "ERROR" | "DUPLICATE";
  messages: string[];
};

type ImportPreview = {
  documents: DocumentPreview[];
  totalDocuments: number;
  totalRows: number;
  validDocuments: number;
  warningDocuments: number;
  errorDocuments: number;
  duplicateDocuments: number;
  totalAmount: number;
};

type Token = {
  id: string;
  tokenPrefix: string;
  source: string;
  label: string | null;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

type Tab = "consolidated" | "import" | "automatic";
type ImportStep = "upload" | "preview" | "result";

// ── Helpers ──────────────────────────────────────────────────────────────────

const money = (v: number) => `$${v.toFixed(2)}`;

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  FACTUROM: { label: "Facturom", className: "bg-blue-50 text-blue-700 border-blue-200" },
  MANUAL_IMPORT: { label: "Archivo", className: "bg-slate-50 text-slate-700 border-slate-200" },
  LEGACY_IMPORT: { label: "Archivo", className: "bg-slate-50 text-slate-700 border-slate-200" },
  API: { label: "API", className: "bg-violet-50 text-violet-700 border-violet-200" },
  TELEGRAM: { label: "Telegram", className: "bg-sky-50 text-sky-700 border-sky-200" },
  SRI_FACTURADOR: { label: "SRI", className: "bg-amber-50 text-amber-700 border-amber-200" },
  OTHER: { label: "Otro", className: "bg-gray-50 text-gray-700 border-gray-200" },
};

const DOC_TYPES: Record<string, string> = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de crédito",
  DEBIT_NOTE: "Nota de débito",
};

const PREVIEW_STATUS: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  VALID: { label: "Válida", className: "text-emerald-700", icon: CheckCircle2 },
  WARNING: { label: "Advertencia", className: "text-amber-700", icon: AlertTriangle },
  ERROR: { label: "Error", className: "text-red-700", icon: XCircle },
  DUPLICATE: { label: "Duplicada", className: "text-slate-500", icon: Clock },
};

// ── Component ────────────────────────────────────────────────────────────────

export function SalesImportClient({ activeTab = "consolidated" }: { activeTab?: Tab }) {

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Consolidar ventas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reúne en un solo lugar tus ventas de Facturom, archivos externos y otras integraciones.
        </p>
      </header>

      <nav aria-label="Importación de ventas" className="flex gap-1 border-b overflow-x-auto">
        {([ ["consolidated", "Consolidado", "/facturacion/sales/imports"], ["import", "Importar archivo", "/facturacion/sales/imports/file"], ["automatic", "Importación automática", "/facturacion/sales/imports/automatic"] ] as const).map(([key, label, href]) => (
          <Link key={key} href={href} aria-current={activeTab === key ? "page" : undefined} className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${activeTab === key ? "border-b-2 border-[#1E52F1] text-[#1E52F1]" : "text-slate-500 hover:text-slate-700"}`}>{label}</Link>
        ))}
      </nav>

      {activeTab === "consolidated" && <ConsolidatedTab />}
      {activeTab === "import" && <ImportTab />}
      {activeTab === "automatic" && <AutomaticTab />}
    </div>
  );
}

// ── Consolidated Tab ─────────────────────────────────────────────────────────

function ConsolidatedTab() {
  const [items, setItems] = useState<ConsolidatedItem[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchData = useCallback(async (p: number, q: string, src: string, f: string, t: string, pp: number) => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("perPage", String(pp));
      if (q) params.set("q", q);
      if (src) params.set("source", src);
      if (f) params.set("from", f);
      if (t) params.set("to", t);

      const res = await fetch(`/api/sales-import/consolidated?${params}`);
      const data = await res.json();
      if (data.ok) {
        setItems(data.items);
        setTotals(data.totals);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page, search, source, from, to, perPage);
  }, [page, source, from, to, perPage, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSearch(q: string) {
    setSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchData(1, q, source, from, to, perPage);
    }, 300);
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniCard label="Ventas consolidadas" value={String(totals.totalSales)} />
          <MiniCard label="Total período" value={money(totals.totalAmount)} />
          <MiniCard label="Facturom" value={String(totals.facturomCount)} />
          <MiniCard label="Externas" value={String(totals.externalCount)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por serie, cliente, identificación..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1); }}
        >
          <option value="">Todas las fuentes</option>
          <option value="FACTUROM">Facturom</option>
          <option value="MANUAL_IMPORT">Archivo</option>
          <option value="API">API</option>
          <option value="TELEGRAM">Telegram</option>
          <option value="SRI_FACTURADOR">SRI</option>
        </select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-36" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-36" />
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Comprobante</th>
                  <th className="px-3 py-2">Número</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Identificación</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2 text-right">IVA</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Fuente</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Cargando...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Sin resultados.</td></tr>
                ) : (
                  items.map((item) => {
                    const badge = SOURCE_BADGES[item.source] ?? SOURCE_BADGES.OTHER;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {item.issueDate ? new Date(item.issueDate).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-3 py-2">{DOC_TYPES[item.documentType] ?? item.documentType}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.documentNumber ?? "—"}</td>
                        <td className="px-3 py-2">{(item.customerName ?? "Consumidor Final").substring(0, 30)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.customerIdentification ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(item.subtotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(item.taxTotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{money(item.total)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">{item.status}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[]; totalAmount: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/sales-import/preview", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        setPreview(data.preview);
        setStep("preview");
      } else {
        alert(data.error ?? "Error al procesar.");
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
      const res = await fetch("/api/sales-import/confirm", { method: "POST", body: form });
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

  function resetImport() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setExpanded(new Set());
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleExpand(serie: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(serie)) next.delete(serie); else next.add(serie);
      return next;
    });
  }

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Las ventas importadas son históricas. No se enviarán al SRI ni modificarán el stock actual.</p>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5" /> Subir archivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/sales-import/template" download>
                <Download className="mr-1 h-4 w-4" /> Descargar plantilla XLSX
              </a>
            </Button>

            <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">CSV o XLSX con el formato de la plantilla</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx" className="mt-3" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <Button onClick={handleUpload} disabled={!file || loading} className="bg-[#1E52F1] hover:bg-[#1E52F1]/90">
              {loading ? "Procesando..." : "Previsualizar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MiniCard label="Documentos" value={String(preview.totalDocuments)} />
            <MiniCard label="Válidos" value={String(preview.validDocuments)} tone="success" />
            <MiniCard label="Advertencias" value={String(preview.warningDocuments)} tone={preview.warningDocuments > 0 ? "error" : undefined} />
            <MiniCard label="Errores" value={String(preview.errorDocuments)} tone={preview.errorDocuments > 0 ? "error" : undefined} />
            <MiniCard label="Duplicados" value={String(preview.duplicateDocuments)} />
          </div>

          <p className="text-sm text-slate-600">Total acumulado: <span className="font-semibold">{money(preview.totalAmount)}</span></p>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2">Serie</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Líneas</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2 text-right">IVA</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.documents.map((doc) => {
                      const st = PREVIEW_STATUS[doc.status];
                      const Icon = st?.icon ?? CheckCircle2;
                      const isExpanded = expanded.has(doc.serie);
                      return (
                        <>
                          <tr key={doc.serie} className="border-b last:border-0 hover:bg-slate-50/50 cursor-pointer" onClick={() => toggleExpand(doc.serie)}>
                            <td className="px-3 py-2">
                              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </td>
                            <td className="px-3 py-2 font-mono text-xs font-medium">{doc.serie}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{doc.issueDate ? new Date(doc.issueDate).toLocaleDateString("es-EC") : "—"}</td>
                            <td className="px-3 py-2">{doc.customerName}</td>
                            <td className="px-3 py-2 text-center">{doc.itemCount}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{money(doc.subtotal)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{money(doc.tax)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{money(doc.total)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${st?.className ?? ""}`}>
                                <Icon className="h-3.5 w-3.5" /> {st?.label ?? doc.status}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${doc.serie}-msgs`}>
                              <td colSpan={9} className="bg-slate-50 px-6 py-2">
                                <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                                  {doc.messages.map((m, i) => <li key={i}>{m}</li>)}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={resetImport}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={preview.errorDocuments > 0 && preview.validDocuments === 0 && preview.warningDocuments === 0 || loading}
              className="bg-[#1E52F1] hover:bg-[#1E52F1]/90"
            >
              {loading ? "Importando..." : `Confirmar importación (${preview.validDocuments + preview.warningDocuments} documentos)`}
            </Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-lg font-semibold text-slate-900">Importación completada</p>
                <p className="text-sm text-slate-600">
                  {result.imported} documentos importados · {result.skipped} omitidos (duplicados) · Total: {money(result.totalAmount)}
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-800">Errores ({result.errors.length}):</p>
                <ul className="mt-1 list-inside list-disc text-xs text-red-700">
                  {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <Button onClick={resetImport} variant="outline">Importar otro archivo</Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Automatic Tab ────────────────────────────────────────────────────────────

type SyncConfig = {
  enabled: boolean;
  sriEnabled: boolean;
  apiEnabled: boolean;
  syncFrequency: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
};

type SyncFrequency = "DAILY" | "EVERY_3_DAYS" | "WEEKLY" | "EVERY_15_DAYS" | "MONTHLY";

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Una vez al día",
  EVERY_3_DAYS: "Cada 3 días",
  WEEKLY: "Una vez por semana",
  EVERY_15_DAYS: "Cada 15 días",
  MONTHLY: "Una vez al mes",
};

const FREQUENCY_OPTIONS: SyncFrequency[] = ["DAILY", "EVERY_3_DAYS", "WEEKLY", "EVERY_15_DAYS", "MONTHLY"];

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AutomaticTab() {
  const progress = useSyncJobs("/api/sales-import/sync-jobs?page=1&pageSize=20");
  const [credential, setCredential] = useState<{ status?: string; verifiedAt?: string | null } | null>(null);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [hasFeature, setHasFeature] = useState<boolean | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchData = useCallback((background = false, signal?: AbortSignal) => {
    return Promise.all([
      fetch("/api/sales-import/auto-sync", { cache: "no-store", signal }),
      fetch("/api/sales-import/tokens", { cache: "no-store", signal }),
    ]).then(async ([syncRes, tokenRes]) => {
      if (!syncRes.ok || !tokenRes.ok) throw new Error("No se pudo cargar la configuración.");
      return Promise.all([syncRes.json(), tokenRes.json()]);
    }).then(([syncData, tokenData]) => {
      if (signal?.aborted) return;
      if (syncData.ok) { setConfig(syncData.config); setHasFeature(syncData.hasFeature); setCredential(syncData.credential); }
      if (tokenData.ok) setTokens(tokenData.tokens);
    }).catch(() => {
      if (!signal?.aborted) setError("No se pudo cargar la configuración de sincronización.");
    }).finally(() => { if (!signal?.aborted && !background) setLoading(false); });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(false, controller.signal);
    return () => controller.abort();
  }, [fetchData]);
  useEffect(() => {
    const controller = new AbortController();
    if (progress.job?.status) void fetchData(true, controller.signal);
    return () => controller.abort();
  }, [fetchData, progress.job?.status, progress.job?.id]);

  async function updateConfig(patch: Record<string, unknown>) {
    setError(""); setMessage("");
    try {
      const res = await fetch("/api/sales-import/auto-sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.ok) { setConfig(data.config); setMessage("Configuración guardada."); }
      else setError(data.error ?? "Error al guardar.");
    } catch { setError("Error de conexión."); }
  }

  async function manualSync() {
    setError(""); setMessage(""); setSyncing(true);
    try {
      const res = await fetch("/api/sales-import/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual_sync" }),
      });
      const data = await res.json();
      if (data.ok) { if (data.job) progress.trackJob(data.job); await progress.refresh(); setMessage("Sincronización manual iniciada."); }
      else setError(data.error ?? "Error al sincronizar.");
    } catch { setError("Error de conexión."); }
    finally { setSyncing(false); }
  }

  async function verifyConnection() {
    setError(""); setSyncing(true);
    try {
      const res = await fetch("/api/sales-import/auto-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify_connection" }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo iniciar la verificación.");
      progress.trackJob(data.job);
    } catch (err) { setError(err instanceof Error ? err.message : "Error de conexión."); }
    finally { setSyncing(false); }
  }

  async function generateToken() {
    setError("");
    try {
      const res = await fetch("/api/sales-import/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "API", label: newLabel || undefined }),
      });
      const data = await res.json();
      if (data.ok) { setNewToken(data.plaintext); setNewLabel(""); fetchData(); }
    } catch { setError("Error al generar token."); }
  }

  async function revokeToken(id: string) {
    if (!confirm("¿Revocar este token? Las integraciones que lo usen dejarán de funcionar.")) return;
    await fetch("/api/sales-import/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: id }),
    });
    fetchData();
  }

  function copyToken() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return <p className="py-8 text-center text-slate-400">Cargando...</p>;

  if (hasFeature === false) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Importación automática
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Premium</span>
            </h2>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Shield className="mx-auto h-12 w-12 text-slate-300" />
            <div>
              <p className="text-lg font-semibold text-slate-900">Disponible en el plan Empresarial</p>
              <p className="mt-1 text-sm text-slate-600">La importación automática desde el SRI y por API está disponible en el plan Empresarial.</p>
            </div>
            <Button asChild className="bg-[#1E52F1] hover:bg-[#1E52F1]/90">
              <a href="/facturacion/settings/billing">Ver planes</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Importación automática
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Premium</span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">Consolida automáticamente ventas creadas fuera de Facturom.</p>
        </div>
      </div>

      {error && <p className="rounded border border-red-300 p-3 text-sm text-red-800">{error}</p>}
      {message && <p className="rounded border border-green-300 p-3 text-sm text-green-800">{message}</p>}

      {progress.error && <p role="alert" className="text-sm text-red-700">{progress.error}</p>}
      {progress.job && <SyncProgressCard job={progress.job} title="Último intento de sincronización de ventas" />}
      <Link className="text-sm text-blue-700 underline" href="/facturacion/sales/imports/sync-history">Consultar historial</Link>

      {/* SRI Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-amber-600" /> SRI / Facturador SRI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Facturom revisa periódicamente los comprobantes emitidos en tu cuenta del SRI e importa únicamente los que aún no existen.</p>

          <p className="text-sm"><Link href="/facturacion/configuration?tab=sri" className="text-blue-700 underline">Configurar credenciales en Empresa → Configuración → SRI</Link></p>
          <Button variant="outline" onClick={verifyConnection} disabled={syncing || ["QUEUED", "RUNNING"].includes(progress.job?.status ?? "")}>Verificar conexión de ventas</Button>
          {!config?.sriEnabled ? (
            <Button onClick={() => updateConfig({ sriEnabled: true })} className="bg-[#1E52F1] hover:bg-[#1E52F1]/90">
              <Shield className="mr-1 h-4 w-4" /> Habilitar consulta SRI
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  {connectionLabel(credential?.status, progress.job, credential?.verifiedAt)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Importación automática</label>
                <button
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? "bg-[#1E52F1]" : "bg-slate-200"}`}
                  onClick={() => updateConfig({ enabled: !config.enabled })}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${config.enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {config.enabled && (
                <>
                  <div>
                    <label className="text-sm font-medium block mb-1">Frecuencia</label>
                    <select
                      className="h-9 rounded-md border bg-white px-3 text-sm"
                      value={config.syncFrequency}
                      onChange={(e) => updateConfig({ syncFrequency: e.target.value })}
                    >
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <p className="text-slate-500">Última sincronización</p>
                      <p className="font-medium">{formatDate(config.lastSyncAt)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Próxima sincronización</p>
                      <p className="font-medium">{formatDate(config.nextSyncAt)}</p>
                    </div>
                  </div>

                  {config.lastError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        {config.lastError === "HUMAN_VERIFICATION_REQUIRED" ? (
                          <>
                            <p className="font-medium">Se requiere verificación manual en el SRI.</p>
                            <Button variant="outline" size="sm" className="mt-2" onClick={manualSync} disabled={syncing}>Verificar conexión</Button>
                          </>
                        ) : (
                          <p>{config.lastError}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <Button variant="outline" onClick={manualSync} disabled={syncing || ["QUEUED", "RUNNING"].includes(progress.job?.status ?? "")} >
                    <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sincronizar ahora
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Integration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-5 w-5 text-violet-600" /> Integración por API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Conecta sistemas externos con Facturom mediante una API segura.</p>

          {!showApiConfig ? (
            <Button variant="outline" onClick={() => setShowApiConfig(true)}>
              <Key className="mr-1 h-4 w-4" /> Configurar API
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Etiqueta (opcional)</label>
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="h-9 w-48" placeholder="Mi integración" />
                </div>
                <Button onClick={generateToken} className="bg-[#1E52F1] hover:bg-[#1E52F1]/90">
                  <Key className="mr-1 h-4 w-4" /> Generar token
                </Button>
              </div>

              {newToken && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-emerald-800">Token generado — cópialo ahora, no se mostrará de nuevo.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-white px-3 py-1.5 font-mono text-xs border">{newToken}</code>
                    <Button variant="outline" size="sm" onClick={copyToken}>
                      <Copy className="mr-1 h-3.5 w-3.5" /> {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>
              )}

              {tokens.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Prefijo</th>
                        <th className="px-3 py-2">Fuente</th>
                        <th className="px-3 py-2">Etiqueta</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Último uso</th>
                        <th className="px-3 py-2">Creado</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((t) => (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{t.tokenPrefix}...</td>
                          <td className="px-3 py-2">{t.source === "TELEGRAM" ? "Telegram" : "API"}</td>
                          <td className="px-3 py-2">{t.label ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-medium ${t.enabled ? "text-emerald-700" : "text-red-600"}`}>
                              {t.enabled ? "Activo" : "Revocado"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString("es-EC") : "Nunca"}</td>
                          <td className="px-3 py-2 text-xs">{new Date(t.createdAt).toLocaleDateString("es-EC")}</td>
                          <td className="px-3 py-2">
                            {t.enabled && (
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => revokeToken(t.id)}>
                                <Trash2 className="mr-1 h-3.5 w-3.5" /> Revocar
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
                <p className="text-sm font-medium">Ejemplo de uso</p>
                <pre className="rounded bg-white border p-3 text-xs overflow-x-auto">{`POST /api/sales-import/ingest
Authorization: Bearer fsi_...

{
  "documentNumber": "001-100-000011434",
  "issueDate": "2026-10-30",
  "subtotal": 17.25,
  "tax": 2.59,
  "total": 19.84,
  "customer": {
    "identification": "1712345678",
    "name": "Cliente ejemplo"
  }
}`}</pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function MiniCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "error" }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "error" ? "text-red-700" : "text-slate-900";
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
