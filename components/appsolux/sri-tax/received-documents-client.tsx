"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  getReceivedSyncState,
  listReceivedDocuments,
} from "@/lib/core/sri-tax/received-documents";
import {
  currency,
  dateLabel,
  fieldClass,
  LoadingError,
  Notice,
  Pager,
  STATUS_LABELS,
  TYPE_LABELS,
  useTaxResource,
} from "./tax-ui";

type ReceivedData = Awaited<ReturnType<typeof listReceivedDocuments>> & {
  sync: Awaited<ReturnType<typeof getReceivedSyncState>>;
};
const emptyFilters = {
  from: "",
  to: "",
  type: "",
  status: "",
  q: "",
  ruc: "",
  accessKey: "",
};

export function ReceivedDocumentsClient() {
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = new URLSearchParams({
    ...filters,
    page: String(page),
    revision: String(revision),
  });
  const { data, loading, error } = useTaxResource<ReceivedData>(
    `/api/sri-tax/received?${query}`,
  );
  const [classify, setClassify] = useState<{
    id: string;
    source: "INBOX" | "PURCHASE";
  } | null>(null);
  const [category, setCategory] = useState("");
  const categories = useTaxResource<{ id: string; name: string }[]>(
    classify ? "/api/purchases/categories" : null,
  );
  async function action(url: string, options: RequestInit) {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      const res = await fetch(url, options);
      const result = await res.json();
      if (!res.ok || result.ok === false)
        throw new Error(result.error ?? "No se pudo completar la acción.");
      setMessage(
        result.purchaseId
          ? "Compra creada por revisar. Complete el desglose fiscal antes de incluirla en los reportes."
          : result.jobId
            ? "Solicitud de sincronización registrada en Compras."
            : "Acción completada.",
      );
      setClassify(null);
      setRevision((v) => v + 1);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Error de conexión.",
      );
    } finally {
      setBusy(false);
    }
  }
  function inboxAction(id: string, actionName: string) {
    return action("/api/sri-tax/received", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: actionName }),
    });
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Documentos importados, manuales y descargados por el módulo de
          Compras.
        </p>
        <div className="flex flex-wrap gap-2">
          <label
            className={`inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white ${busy ? "pointer-events-none opacity-50" : ""}`}
          >
            Importar XML
            <input
              aria-label="Importar XML"
              className="sr-only"
              type="file"
              accept=".xml,application/xml,text/xml"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 4 * 1024 * 1024) {
                  setActionError("El XML no puede superar 4 MB.");
                  return;
                }
                const form = new FormData();
                form.append("file", file);
                void action("/api/purchases/import-xml", {
                  method: "POST",
                  body: form,
                });
              }}
            />
          </label>
          {data?.sync.available &&
            data.sync.credentialStatus === "VERIFIED" && (
              <Button
                variant="outline"
                disabled={busy || !!data.sync.activeJob}
                onClick={() =>
                  action("/api/purchases/sri-sync/run", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      dateFrom: filters.from || undefined,
                      dateTo: filters.to || undefined,
                    }),
                  })
                }
              >
                Sincronizar ahora
              </Button>
            )}
        </div>
      </div>
      {message && (
        <p role="status" className="rounded-xl border bg-muted/30 p-3 text-sm">
          {message}
        </p>
      )}
      {actionError && <Notice error>{actionError}</Notice>}
      {data && (
        <section className="flex flex-wrap gap-4 rounded-xl border p-4 text-sm">
          <span>
            Descarga automática:{" "}
            {data.sync.available
              ? data.sync.syncStatus === "ACTIVE"
                ? "Activa"
                : data.sync.syncStatus === "ERROR"
                  ? "Error"
                  : "Pendiente"
              : "Pendiente de instalación"}
          </span>
          <span>Última sincronización: {dateLabel(data.sync.lastSyncAt)}</span>
          <span>Próxima sincronización: {dateLabel(data.sync.nextSyncAt)}</span>
          <Link
            href="/facturacion/purchases/automatic-download"
            className="text-blue-600"
          >
            Configurar automatización
          </Link>
        </section>
      )}
      <form
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...draft });
          setPage(1);
        }}
      >
        {(
          [
            ["from", "Desde"],
            ["to", "Hasta"],
            ["q", "Proveedor / emisor o documento"],
            ["ruc", "RUC"],
            ["accessKey", "Clave de acceso"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-1 text-sm">
            {label}
            <input
              className={fieldClass}
              type={key === "from" || key === "to" ? "date" : "text"}
              value={draft[key]}
              maxLength={150}
              onChange={(e) =>
                setDraft((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </label>
        ))}
        <label className="grid gap-1 text-sm">
          Tipo
          <select
            className={fieldClass}
            value={draft.type}
            onChange={(e) => setDraft((v) => ({ ...v, type: e.target.value }))}
          >
            <option value="">Todos</option>
            {data?.supportedTypes.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Estado
          <select
            className={fieldClass}
            value={draft.status}
            onChange={(e) =>
              setDraft((v) => ({ ...v, status: e.target.value }))
            }
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="REGISTERED">Registrados</option>
            <option value="IGNORED">Ignorados / anulados</option>
            <option value="PROBLEM">Con problemas</option>
          </select>
        </label>
        <Button type="submit" variant="outline" className="self-end">
          Filtrar
        </Button>
      </form>
      <LoadingError loading={loading} error={error} />
      {classify && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action("/api/sri-tax/received", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...classify,
                action: "classify",
                categoryId: category,
              }),
            });
          }}
        >
          <label className="grid gap-1 text-sm">
            Categoría contable
            <select
              className={fieldClass}
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Selecciona una categoría</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy || !category} type="submit">
            Guardar clasificación
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => setClassify(null)}
          >
            Cancelar
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            La categoría contable no asigna automáticamente un casillero IVA.{" "}
            {categories.data?.length === 0
              ? "Crea categorías desde Compras para poder clasificar."
              : ""}
          </p>
          {categories.error && <Notice error>{categories.error}</Notice>}
        </form>
      )}
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total} documentos. Cada compra vinculada a la bandeja se
            muestra una sola vez.
          </p>
          {!data.items.length ? (
            <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
              No hay comprobantes recibidos para estos filtros.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "Documento",
                      "Tipo",
                      "Emisor",
                      "RUC",
                      "Fecha",
                      "Subtotal",
                      "IVA",
                      "Total",
                      "Estado",
                      "Origen",
                      "Acciones",
                    ].map((h) => (
                      <th className="p-3 font-medium" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((d) => (
                    <tr
                      className="border-t align-top"
                      key={`${d.source}-${d.id}`}
                    >
                      <td
                        className="p-3 font-mono text-xs"
                        title={d.accessKey ?? undefined}
                      >
                        {d.number ?? "Por completar"}
                      </td>
                      <td className="p-3">
                        {TYPE_LABELS[d.type ?? ""] ??
                          d.type ??
                          "Por clasificar"}
                      </td>
                      <td className="max-w-48 p-3">
                        {d.name ?? "Por completar"}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {d.ruc ?? "Por completar"}
                      </td>
                      <td className="p-3">{dateLabel(d.date)}</td>
                      <td className="p-3 tabular-nums">{currency(d.base)}</td>
                      <td className="p-3 tabular-nums">{currency(d.iva)}</td>
                      <td className="p-3 tabular-nums">{currency(d.total)}</td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-1 text-xs ${["NEEDS_REVIEW", "REJECTED"].includes(d.status) ? "bg-amber-50 text-amber-800" : ["REGISTERED", "AUTHORIZED"].includes(d.status) ? "bg-green-50 text-green-800" : "bg-muted"}`}
                        >
                          {STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {d.origin === "SRI_SYNC"
                          ? "SRI"
                          : d.origin === "XML_IMPORT"
                            ? "XML importado"
                            : "Manual"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {d.purchaseId && (
                            <Link
                              className="text-blue-600 hover:underline"
                              href={`/facturacion/purchases/documents/${d.purchaseId}`}
                            >
                              Ver compra
                              {["REGISTERED", "AUTHORIZED"].includes(d.status)
                                ? " registrada"
                                : " por revisar"}
                            </Link>
                          )}
                          {d.canRegister && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => inboxAction(d.id, "register")}
                            >
                              Registrar compra
                            </Button>
                          )}
                          {!["CANCELLED", "IGNORED", "REJECTED"].includes(
                            d.status,
                          ) && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                setClassify({ id: d.id, source: d.source });
                                setCategory("");
                              }}
                            >
                              Clasificar
                            </Button>
                          )}
                          {d.canIgnore && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => inboxAction(d.id, "ignore")}
                            >
                              Ignorar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={data.totalPages} setPage={setPage} />
          <p className="text-xs text-muted-foreground">{data.xmlNotice}</p>
        </>
      )}
    </div>
  );
}
