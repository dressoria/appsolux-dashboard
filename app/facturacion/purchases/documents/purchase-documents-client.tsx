"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { routes } from "@/config/routes";

type PurchaseDoc = {
  id: string;
  documentType: string;
  supplierDocumentNumber: string | null;
  supplierName: string | null;
  supplierIdentification: string | null;
  issueDate: string | null;
  subtotal0: string;
  subtotal15: string;
  ivaTotal: string;
  total: string;
  status: string;
  origin: string;
  accountingCategory: { name: string } | null;
  supplier: { name: string; identification: string | null } | null;
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
};

export function PurchaseDocumentsClient() {
  const [docs, setDocs] = useState<PurchaseDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("documentType", typeFilter);
    params.set("page", String(page));
    const res = await fetch(`/api/purchases/documents?${params}`);
    const data = await res.json();
    setDocs(data.items ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [q, from, to, statusFilter, typeFilter, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documentos de compra</h1>
          <p className="text-sm text-muted-foreground">Facturas, notas de crédito y otros documentos recibidos</p>
        </div>
        <div className="flex gap-2">
          <Link href={routes.facturacionPurchasesNew}>
            <Button>Registrar compra</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Input placeholder="Buscar proveedor / RUC / documento" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-64" />
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No hay documentos de compra.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nº Documento</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">RUC</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                    <th className="px-4 py-3 font-medium text-right">IVA</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Origen</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs">{doc.supplierDocumentNumber || "—"}</td>
                      <td className="px-4 py-3">{doc.supplier?.name ?? doc.supplierName ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{doc.supplier?.identification ?? doc.supplierIdentification ?? "—"}</td>
                      <td className="px-4 py-3">{TYPE_LABELS[doc.documentType] ?? doc.documentType}</td>
                      <td className="px-4 py-3">{doc.issueDate ? new Date(doc.issueDate).toLocaleDateString("es-EC") : "—"}</td>
                      <td className="px-4 py-3 text-right">${(Number(doc.subtotal0) + Number(doc.subtotal15)).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">${Number(doc.ivaTotal).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium">${Number(doc.total).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className="rounded bg-muted px-2 py-0.5 text-xs">{ORIGIN_LABELS[doc.origin] ?? doc.origin}</span></td>
                      <td className="px-4 py-3 text-xs">{doc.accountingCategory?.name ?? "—"}</td>
                      <td className="px-4 py-3"><span className="rounded bg-muted px-2 py-0.5 text-xs">{STATUS_LABELS[doc.status] ?? doc.status}</span></td>
                      <td className="px-4 py-3">
                        <Link href={`/facturacion/purchases/documents/${doc.id}`} className="text-primary hover:underline text-xs">Ver</Link>
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
    </div>
  );
}
