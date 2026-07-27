"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, FileSearch, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SriDownloadButton } from "@/components/appsolux/sri/sri-download-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BillingDocumentListItem } from "@/lib/core/billing/billing-documents";

// ── Badge helpers ─────────────────────────────────────────────────────────────

type BadgeVariant = "neutral" | "success" | "info" | "warning" | "danger";

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
};

function Badge({ label, variant = "neutral" }: { label: string; variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${BADGE_CLASSES[variant]}`}
    >
      {label}
    </span>
  );
}

function internalStatusVariant(status: string | null): BadgeVariant {
  if (status === "paid") return "success";
  if (status === "pending" || status === "partial") return "warning";
  if (status === "canceled") return "danger";
  return "neutral";
}

function sriStatusVariant(status: string | null): BadgeVariant {
  if (status === "AUTHORIZED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "SENT" || status === "SIGNED") return "info";
  if (status === "READY_FOR_TESTING") return "warning";
  return "neutral";
}

function money(value: string | number | null) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Type filter ───────────────────────────────────────────────────────────────

type TypeFilter = "all" | "receipt" | "sri" | "authorized" | "pending" | "rejected" | "canceled";

const TYPE_FILTER_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "receipt", label: "Recibos" },
  { key: "sri", label: "Facturas SRI" },
  { key: "authorized", label: "Autorizados" },
  { key: "pending", label: "Pendientes" },
  { key: "rejected", label: "Rechazados" },
  { key: "canceled", label: "Cancelados" },
];

function matchesTypeFilter(doc: BillingDocumentListItem, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "receipt") return doc.type === "BASIC_SALE" && !doc.sriDocumentId;
  if (filter === "sri") return !!doc.sriDocumentId || doc.type === "SRI_DOCUMENT";
  if (filter === "authorized") return doc.sriStatus === "AUTHORIZED";
  if (filter === "pending") {
    return (
      doc.sriStatus === "DRAFT" ||
      doc.sriStatus === "READY_FOR_TESTING" ||
      doc.sriStatus === "SIGNED" ||
      doc.sriStatus === "SENT" ||
      doc.internalStatus === "pending" ||
      doc.internalStatus === "partial"
    );
  }
  if (filter === "rejected") return doc.sriStatus === "REJECTED";
  if (filter === "canceled") return doc.internalStatus === "canceled" || doc.sriStatus === "CANCELLED";
  return true;
}

function matchesSearch(doc: BillingDocumentListItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (doc.customerName?.toLowerCase().includes(q)) return true;
  if (doc.displayNumber?.toLowerCase().includes(q)) return true;
  if (doc.id.toLowerCase().includes(q)) return true;
  if (doc.itemsSummary?.toLowerCase().includes(q)) return true;
  if (doc.authorizationNumber?.toLowerCase().includes(q)) return true;
  if (doc.accessKey?.toLowerCase().includes(q)) return true;
  return false;
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocumentRow({ doc }: { doc: BillingDocumentListItem }) {
  const isErpDoc = doc.type === "SRI_DOCUMENT";
  const isInternalReceipt = doc.type === "BASIC_SALE" && !doc.sriDocumentId;
  const canDownloadSignedXml =
    !!doc.sriDocumentId &&
    (doc.sriStatus === "SIGNED" ||
      doc.sriStatus === "SENT" ||
      doc.sriStatus === "AUTHORIZED" ||
      doc.sriStatus === "REJECTED");
  const canCheckAuthorization =
    !!doc.sriDetailHref &&
    !!doc.accessKey &&
    (doc.sriStatus === "SENT" || doc.sriStatus === "SIGNED" || doc.sriStatus === "REJECTED");

  return (
    <div className="space-y-3 rounded-[22px] border border-slate-200 bg-white p-4 text-sm shadow-sm transition-colors hover:border-[#588100]/30 hover:shadow-[0_14px_40px_rgba(88,129,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge label={isInternalReceipt ? "Recibo interno" : "Factura SRI"} variant={isInternalReceipt ? "neutral" : "info"} />
            {doc.internalStatusLabel && !isErpDoc && (
              <Badge label={doc.internalStatusLabel} variant={internalStatusVariant(doc.internalStatus)} />
            )}
            {doc.sriStatus && (
              <Badge label={doc.sriStatusLabel ?? doc.sriStatus} variant={sriStatusVariant(doc.sriStatus)} />
            )}
            {doc.environment && (
              <Badge
                label={doc.environment === "TEST" ? "Pruebas" : "Producción"}
                variant={doc.environment === "TEST" ? "warning" : "info"}
              />
            )}
          </div>

          <p className="font-medium text-slate-900">
            {doc.customerName ?? "Consumidor Final"}
          </p>
          <p className="text-xs text-slate-500">
            {formatDate(doc.issuedAt)}
          </p>
          {doc.displayNumber ? (
            <p className="font-mono text-[11px] text-slate-500">{doc.displayNumber}</p>
          ) : (
            <p className="font-mono text-[11px] text-slate-400">ID: {doc.id.slice(-10).toUpperCase()}</p>
          )}
          {doc.itemsSummary && (
            <p className="max-w-sm truncate text-xs text-slate-400">{doc.itemsSummary}</p>
          )}
          {doc.itemsUnavailable && (
            <p className="text-xs text-slate-400">
              Detalle de items no disponible con los permisos actuales.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</p>
          <p className="font-mono text-lg font-semibold text-slate-900">{money(doc.total)}</p>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {doc.saleDetailHref && (
              <Button asChild variant="outline" size="sm">
                <Link href={doc.saleDetailHref}>Ver venta</Link>
              </Button>
            )}
            {doc.sriDetailHref && (
              <Button asChild variant="outline" size="sm">
                <Link href={doc.sriDetailHref}>
                  {doc.type === "SRI_DOCUMENT" ? "Ver factura SRI" : "Ver factura SRI"}
                </Link>
              </Button>
            )}
            {isInternalReceipt && (
              <SriDownloadButton
                href={`/api/basic/sales/${doc.id}/download-receipt`}
                label="Recibo PDF"
                icon="receipt"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
            {canDownloadSignedXml && (
                <SriDownloadButton
                  href={`/api/sri/documents/${doc.sriDocumentId}/download-signed-xml`}
                  label="XML"
                  icon="download"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              )}
            {doc.sriDocumentId && doc.sriStatus === "AUTHORIZED" && (
              <>
                <SriDownloadButton
                  href={`/api/sri/documents/${doc.sriDocumentId}/download-authorized-xml`}
                  label="Descargar XML"
                  icon="file-check"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <SriDownloadButton
                  href={`/api/sri/documents/${doc.sriDocumentId}/download-ride`}
                  label="RIDE / PDF"
                  icon="file-text"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </>
            )}
            {canCheckAuthorization && (
              <Button asChild variant="outline" size="sm">
                <Link href={doc.sriDetailHref!}>Consultar autorización</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {doc.sriStatus && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          {doc.sriStatus === "AUTHORIZED" && doc.authorizationNumber && (
            <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
              <div>
                <p className="font-medium text-slate-500">Autorización</p>
                <p className="font-mono text-slate-800 break-all">{doc.authorizationNumber}</p>
              </div>
              {doc.authorizationDate && (
                <div>
                  <p className="font-medium text-slate-500">Fecha autorización</p>
                  <p className="text-slate-800">{formatDate(doc.authorizationDate)}</p>
                </div>
              )}
              {doc.accessKey && (
                <div>
                  <p className="font-medium text-slate-500">Clave de acceso</p>
                  <p className="font-mono text-[10px] text-slate-600 break-all leading-5">
                    {doc.accessKey.slice(0, 30)}…
                  </p>
                </div>
              )}
            </div>
          )}

          {doc.sriStatus === "REJECTED" && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs">
              <p className="font-medium text-red-700">
                {doc.rejectionMessage ?? "El SRI rechazó el comprobante. Ver detalle para más información."}
              </p>
            </div>
          )}
          {(doc.sriStatus === "SIGNED" || doc.sriStatus === "SENT" || doc.sriStatus === "READY_FOR_TESTING" || doc.sriStatus === "DRAFT") && (
            <p className="text-xs text-slate-500">
              {doc.sriStatus === "SENT"
                ? "Recibido por el SRI — esperando autorización automática."
                : doc.sriStatus === "SIGNED"
                  ? "Firmado — pendiente de autorización."
                  : "Documento en preparación antes del envío al SRI."}
            </p>
          )}
          {doc.accessKey &&
            doc.sriStatus !== "AUTHORIZED" &&
            doc.sriStatus !== "REJECTED" && (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-400 hover:text-slate-600">
                  Clave de acceso
                </summary>
                <p className="mt-1 break-all font-mono text-[10px] leading-5 text-slate-600">
                  {doc.accessKey}
                </p>
              </details>
            )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BillingDocumentsList({
  items,
  mode,
  page = 1,
  totalPages = 1,
  totalItems = 0,
  prevHref,
  nextHref,
  statusOptions = [],
  currentStatus = "all",
}: {
  items: BillingDocumentListItem[];
  mode: "CORE" | "SHARED_ERP";
  page?: number;
  totalPages?: number;
  totalItems?: number;
  prevHref?: string;
  nextHref?: string;
  statusOptions?: Array<{ key: string; label: string; href: string }>;
  currentStatus?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    return items.filter(
      (doc) => matchesTypeFilter(doc, typeFilter) && matchesSearch(doc, search)
    );
  }, [items, search, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Buscar por cliente, número, autorización, clave o ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-slate-200 bg-white pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {statusOptions.length > 0 ? (
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600">
              <span className="shrink-0 text-xs font-medium text-slate-500">Estado</span>
              <select
                value={currentStatus}
                onChange={(event) => {
                  const selected = statusOptions.find((option) => option.key === event.target.value);
                  if (selected) router.push(selected.href);
                }}
                className="h-10 w-full bg-transparent text-sm text-slate-700 outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === key
                  ? "border-[#588100] bg-[#588100] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#588100]/30 hover:text-[#588100]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}

        {filtered.length === 0 && (
          <div className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <FileSearch className="h-6 w-6" />
            </div>
            <p>
              {search || typeFilter !== "all"
                ? "No hay documentos que coincidan con los filtros aplicados."
                : "Aún no hay documentos."}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {totalItems} resultado{totalItems !== 1 ? "s" : ""} · página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={!prevHref}>
              {prevHref ? (
                <Link href={prevHref}>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Link>
              ) : (
                <span>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </span>
              )}
            </Button>
            <Button asChild variant="outline" size="sm" disabled={!nextHref}>
              {nextHref ? (
                <Link href={nextHref}>
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span>
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
