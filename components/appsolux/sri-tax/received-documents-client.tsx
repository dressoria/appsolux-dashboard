"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Dialog, DropdownMenu } from "radix-ui";
import { MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlobButton } from "@/components/ui/blob-button";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { useSyncJobs } from "./use-sync-jobs";
import { SyncProgressCard } from "./sync-progress-card";
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
  const [view, setView] = useState("UNREGISTERED");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ReceivedData["items"][number] | null>(null);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number; rejected: number; pending: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jobs = useSyncJobs("/api/purchases/sri-sync/jobs?pageSize=5");
  const query = new URLSearchParams({
    ...filters,
    page: String(page),
    revision: String(revision),
    view,
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
  async function action(url: string, options: RequestInit, importing = false) {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    if (importing) setImportSummary(null);
    try {
      const res = await fetch(url, options);
      const result = await res.json();
      if (!res.ok || result.ok === false || typeof result.error === "string") {
        if (importing) {
          const repeated = String(result.error ?? "").includes("ya está registrado");
          setImportSummary({ imported: 0, skipped: repeated ? 1 : 0, rejected: repeated ? 0 : 1, pending: 0 });
        }
        throw new Error(result.error ?? result.message ?? "No se pudo completar la acción.");
      }
      if (importing) setImportSummary({ imported: result.purchaseDocumentId ? 1 : 0, skipped: 0, rejected: 0, pending: result.purchaseDocumentId && result.reviewRequired ? 1 : 0 });
      if (result.job) jobs.trackJob(result.job);
      setMessage(
        result.purchaseId
          ? "Compra creada por revisar. Complete el desglose fiscal antes de incluirla en los reportes."
          : result.purchaseDocumentId
            ? "XML importado al registro local de Compras. Requiere revisión; no se consultó la autorización vigente en el SRI."
            : result.jobId
            ? "Solicitud de sincronización registrada en Compras."
            : "Acción completada en los registros locales.",
      );
      setClassify(null);
      setRevision((v) => v + 1);
    } catch (error) {
      if (importing && error instanceof TypeError) setImportSummary(null);
      setActionError(
        error instanceof Error ? error.message : "Error de conexión.",
      );
    } finally {
      setBusy(false);
    }
  }
  const currentJob = jobs.job;
  const running = currentJob ? ["QUEUED", "RUNNING"].includes(currentJob.status) : Boolean(data?.sync.activeJob);
  const syncEnabled = data?.sync.available && data.sync.credentialStatus === "VERIFIED";
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
          <BlobButton disabled={busy} onClick={() => { setImportSummary(null); fileRef.current?.click(); }}>Importar XML</BlobButton>
            <input
              ref={fileRef}
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
                }, true);
              }}
            />
          <Button asChild variant="outline" className="h-11"><Link href="/facturacion/purchases/txt-import">Importar TXT en Compras</Link></Button>
              <Button
                variant="outline"
                className="h-11"
                disabled={busy || running || !syncEnabled}
                title={!syncEnabled ? "Configura y verifica las credenciales en el módulo de Compras." : undefined}
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
                {running ? "Sincronización en proceso" : "Sincronizar ahora"}
              </Button>
        </div>
      </div>
      {message && (
        <p role="status" className="rounded-xl border bg-muted/30 p-3 text-sm">
          {message}
        </p>
      )}
      {actionError && <Notice error>{actionError}</Notice>}
      {importSummary && <section aria-label="Resultado de importación" className="rounded-2xl border bg-white p-4 text-sm"><p className="font-semibold">Resultado de la importación XML</p><p className="mt-2">Importados: {importSummary.imported} · Repetidos: {importSummary.skipped} · Rechazados: {importSummary.rejected} · Pendientes de revisión: {importSummary.pending}</p><p className="mt-2 text-xs text-slate-600">La revisión pendiente es un subconjunto de los importados. El importador registra datos locales; este resultado no confirma autorización vigente del SRI ni contabilización.</p></section>}
      {currentJob ? <SyncProgressCard job={currentJob} title="Último trabajo registrado en Compras" /> : <p className="text-sm text-slate-600">{!data ? loading ? "Consultando estado de sincronización…" : "Estado de sincronización no disponible." : syncEnabled ? "Disponible para solicitar una sincronización; no hay resultados del trabajo para mostrar." : "Sincronización no configurada o credenciales sin verificar."}</p>}
      {jobs.error ? <Notice error>{jobs.error}</Notice> : null}
      {data && (
        <section className="flex flex-wrap gap-4 rounded-xl border p-4 text-sm">
          <span>
            Configuración de descarga:{" "}
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
      <AnimatedSegmentedControl label="Vistas de comprobantes recibidos" value={view} onValueChange={(value) => { setView(value); setPage(1); setSelected(new Set()); }}
        options={[{ value: "UNREGISTERED", label: `Sin registrar${data ? ` (${data.counts.unregistered})` : ""}` }, { value: "REGISTERED", label: `Registradas${data ? ` (${data.counts.registered})` : ""}` }, { value: "CANCELLED", label: `Anuladas${data ? ` (${data.counts.cancelled})` : ""}` }]} className="w-full" />
      <p className="text-xs leading-relaxed text-slate-600">Sin registrar incluye compras por revisar. Registradas corresponde al estado de compra en Facturom. Anuladas reúne cancelaciones y exclusiones internas: no demuestra anulación oficial por el emisor ni por el SRI.</p>
      <form
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...draft });
          setPage(1);
          setSelected(new Set());
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
            <option value="IGNORED">Excluidos / cancelados localmente</option>
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
            <div className="max-w-full overflow-x-auto rounded-xl border" role="region" aria-label="Listado de comprobantes recibidos" tabIndex={0}>
              <table className="w-full min-w-[1600px] text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "#", "Selección", "Fecha de emisión", "Fecha de autorización", "Retención", "Comprobante", "Comprador / receptor", "N.º comprobante", "Tipo", "Identificación", "Proveedor", "Estado", "Acciones",
                    ].map((h) => (
                      <th className="p-3 font-medium" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((d, index) => (
                    <tr className="border-t align-top" key={`${d.source}-${d.id}`}>
                      <td className="p-3 text-slate-500">{(page - 1) * data.pageSize + index + 1}</td>
                      <td className="p-3"><input type="checkbox" aria-label={`Seleccionar comprobante ${d.number ?? d.id}`} checked={selected.has(`${d.source}-${d.id}`)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(`${d.source}-${d.id}`); else next.delete(`${d.source}-${d.id}`); return next; })} /></td>
                      <td className="whitespace-nowrap p-3">{dateLabel(d.date)}</td>
                      <td className="whitespace-nowrap p-3">{dateLabel(d.authorizationDate)}</td>
                      <td className="p-3 text-slate-500">Sin información</td>
                      <td className="p-3">{TYPE_LABELS[d.type ?? ""] ?? d.type ?? "Por clasificar"}<span className="mt-1 block text-xs text-slate-500">{d.origin === "SRI_SYNC" ? "Importado por sincronización" : d.origin === "XML_IMPORT" ? "XML importado" : "Registro manual"}</span></td>
                      <td className="p-3 text-slate-500">Sin información</td>
                      <td className="whitespace-nowrap p-3 font-mono text-xs" title={d.accessKey ?? undefined}>{d.number ?? "Por completar"}</td>
                      <td className="p-3 text-xs">{d.type ?? "No disponible"}</td>
                      <td className="p-3 font-mono text-xs">{d.ruc ?? "Por completar"}</td>
                      <td className="max-w-60 p-3">{d.name ?? "Por completar"}</td>
                      <td className="min-w-48 p-3"><span className="block text-xs font-medium">Registro: {d.status === "CANCELLED" ? "Cancelado internamente" : d.status === "IGNORED" ? "Excluido localmente" : d.status === "AUTHORIZED" ? "Autorizado (estado local)" : STATUS_LABELS[d.status] ?? d.status}</span><span className="mt-1 block text-xs text-slate-500">Anulación SRI: sin verificar</span></td>
                      <td className="p-3">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild><Button type="button" variant="outline" size="icon" aria-label={`Acciones del comprobante ${d.number ?? d.id}`}><MoreHorizontal /></Button></DropdownMenu.Trigger>
                          <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={5} className="z-50 min-w-60 max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-1.5 text-sm shadow-xl">
                            <DropdownMenu.Item className="rounded-lg px-3 py-2.5 outline-none focus:bg-facturom-action-soft" onSelect={() => setDetail(d)}>Ver detalle</DropdownMenu.Item>
                            {d.purchaseId && <DropdownMenu.Item asChild><Link className="block rounded-lg px-3 py-2.5 outline-none focus:bg-facturom-action-soft" href={`/facturacion/purchases/documents/${d.purchaseId}`}>Ver compra{["REGISTERED", "AUTHORIZED"].includes(d.status) ? " registrada" : " por revisar"}</Link></DropdownMenu.Item>}
                            {d.canRegister && <DropdownMenu.Item disabled={busy} className="rounded-lg px-3 py-2.5 outline-none focus:bg-facturom-action-soft data-[disabled]:opacity-50" onSelect={() => void inboxAction(d.id, "register")}>Registrar compra</DropdownMenu.Item>}
                            {!["CANCELLED", "IGNORED", "REJECTED"].includes(d.status) && <DropdownMenu.Item disabled={busy} className="rounded-lg px-3 py-2.5 outline-none focus:bg-facturom-action-soft data-[disabled]:opacity-50" onSelect={() => { setClassify({ id: d.id, source: d.source }); setCategory(""); }}>Clasificar</DropdownMenu.Item>}
                            {d.canIgnore && <DropdownMenu.Item disabled={busy} className="rounded-lg px-3 py-2.5 outline-none focus:bg-facturom-action-soft data-[disabled]:opacity-50" onSelect={() => void inboxAction(d.id, "ignore")}>Excluir de bandeja (local)</DropdownMenu.Item>}
                            <DropdownMenu.Separator className="my-1 border-t" />
                            {["Ver XML original · no disponible", "Imprimir representación · no disponible", "Consultar anulación SRI · pendiente"].map((label) => <DropdownMenu.Item disabled key={label} className="rounded-lg px-3 py-2 text-xs text-slate-500">{label}</DropdownMenu.Item>)}
                          </DropdownMenu.Content></DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={data.totalPages} setPage={(value) => { setPage(value); setSelected(new Set()); }} />
          <p className="text-xs text-slate-600">{data.items.filter((item) => selected.has(`${item.source}-${item.id}`)).length} seleccionados en esta página. Receptor y retenciones se indican sin información cuando no están persistidos; no se infieren de la empresa activa.</p>
          <p className="text-xs text-muted-foreground">{data.xmlNotice}</p>
        </>
      )}
      <Dialog.Root open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3"><Dialog.Title className="font-semibold">Detalle del comprobante</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Cerrar detalle"><X /></Button></Dialog.Close></div>
          <Dialog.Description className="mt-2 text-sm text-slate-600">Datos del registro local. No es un XML original ni una representación autorizada del SRI.</Dialog.Description>
          {detail && <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{[["Comprobante", detail.number], ["Proveedor", detail.name], ["Identificación", detail.ruc], ["Emisión", dateLabel(detail.date)], ["Autorización registrada", dateLabel(detail.authorizationDate)], ["Origen", detail.origin], ["Base registrada", currency(detail.base)], ["IVA registrado", currency(detail.iva)], ["Total registrado", currency(detail.total)], ["Estado interno", detail.status], ["Anulación SRI", "Sin verificar"], ["Clave de acceso", detail.accessKey]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-all">{value || "Sin información"}</dd></div>)}</dl>}
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
