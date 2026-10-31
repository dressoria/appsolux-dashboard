"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PurchaseDoc = {
  id: string;
  documentType: string;
  supplierDocumentNumber: string | null;
  accessKey: string | null;
  supplierName: string | null;
  supplierIdentification: string | null;
  issueDate: string | null;
  subtotal0: string;
  subtotal15: string;
  ivaTotal: string;
  total: string;
  status: string;
  origin: string;
  supplier: { name: string; identification: string | null } | null;
};

type Totals = {
  count: number;
  subtotal0: number;
  subtotal15: number;
  ivaTotal: number;
  total: number;
  byOrigin: Array<{ origin: string; count: number; total: number }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  REGISTERED: "Registrada",
  AUTHORIZED: "Autorizada",
  CANCELLED: "Anulada",
  REJECTED: "Rechazada",
  NEEDS_REVIEW: "Revisar",
};

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de crédito",
  DEBIT_NOTE: "Nota de débito",
  PURCHASE_SETTLEMENT: "Liquidación",
  OTHER: "Otro",
};

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  XML_IMPORT: "XML",
  SRI_SYNC: "SRI",
  TXT_IMPORT: "TXT",
};

const STATUS_COLORS: Record<string, string> = {
  AUTHORIZED: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20",
  REGISTERED: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20",
  DRAFT: "text-slate-600 bg-slate-50 dark:text-slate-300 dark:bg-slate-800",
  CANCELLED: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/20",
  REJECTED: "text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/20",
  NEEDS_REVIEW: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/20",
};

function XmlModal({ purchaseId, onClose }: { purchaseId: string; onClose: () => void }) {
  const [xml, setXml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/purchases/documents/${purchaseId}`);
        const data = await res.json();
        if (data.xmlPath) {
          setXml("XML almacenado en: " + data.xmlPath);
        } else if (data.accessKey) {
          const soapRes = await fetch(`/api/purchases/documents/${purchaseId}/xml`);
          const soapData = await soapRes.json();
          if (soapData.ok) {
            setXml(soapData.xml);
          } else {
            setError(soapData.error ?? "XML no disponible.");
          }
        } else {
          setError("Este documento no tiene XML asociado.");
        }
      } catch {
        setError("Error al obtener el XML.");
      } finally {
        setLoading(false);
      }
    })();
  }, [purchaseId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 max-h-[80vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-6 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">XML del comprobante</h3>
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Cargando XML...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {xml && (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-slate-50 p-4 text-xs dark:bg-slate-800">
            {xml}
          </pre>
        )}
      </div>
    </div>
  );
}

export function PurchasesConsolidatedClient() {
  const [docs, setDocs] = useState<PurchaseDoc[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [xmlDocId, setXmlDocId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("documentType", typeFilter);
    if (originFilter) params.set("origin", originFilter);
    params.set("page", String(page));
    params.set("pageSize", "25");
    const res = await fetch(`/api/purchases/consolidated?${params}`);
    const data = await res.json();
    setDocs(data.items ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setTotals(data.totals ?? null);
    setLoading(false);
  }, [q, from, to, statusFilter, typeFilter, originFilter, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compras — Consolidado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista unificada de todos los comprobantes de compra: importados por archivo, sincronizados
          desde el SRI y registrados manualmente.
        </p>
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total documentos</p>
              <p className="text-xl font-bold">{totals.count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Subtotal 0%</p>
              <p className="text-xl font-bold">{fmt(totals.subtotal0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Subtotal IVA</p>
              <p className="text-xl font-bold">{fmt(totals.subtotal15)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">IVA</p>
              <p className="text-xl font-bold text-blue-600">{fmt(totals.ivaTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(totals.total)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {totals && totals.byOrigin.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          {totals.byOrigin.map((o) => (
            <span key={o.origin} className="rounded-full bg-muted px-3 py-1 text-xs">
              {ORIGIN_LABELS[o.origin] ?? o.origin}: {o.count} docs — {fmt(o.total)}
            </span>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar proveedor / RUC / Nº / clave de acceso"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="w-72"
            />
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={originFilter} onChange={(e) => { setOriginFilter(e.target.value); setPage(1); }} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todos los orígenes</option>
              {Object.entries(ORIGIN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay comprobantes de compra registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">RUC</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Nº Documento</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2 text-right">IVA</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2">XML</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 truncate max-w-[180px]">
                        {doc.supplier?.name ?? doc.supplierName ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {doc.supplier?.identification ?? doc.supplierIdentification ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{doc.supplierDocumentNumber || "—"}</td>
                      <td className="px-3 py-2 text-xs">{TYPE_LABELS[doc.documentType] ?? doc.documentType}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(Number(doc.subtotal0) + Number(doc.subtotal15))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(doc.ivaTotal))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(Number(doc.total))}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status] ?? "bg-muted"}`}>
                          {STATUS_LABELS[doc.status] ?? doc.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          {ORIGIN_LABELS[doc.origin] ?? doc.origin}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {doc.accessKey ? (
                          <button
                            onClick={() => setXmlDocId(doc.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ver XML
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} documentos</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="px-2 py-1">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {xmlDocId && <XmlModal purchaseId={xmlDocId} onClose={() => setXmlDocId(null)} />}
    </div>
  );
}
