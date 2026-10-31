"use client";

import Link from "next/link";
import { ArrowRight, History, RefreshCw, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesSyncProgressCard } from "./sync-progress-card";
import { salesCredentialLabel, salesSessionLabel, type SyncJobView } from "@/lib/core/sri-sync-presentation";

export type SalesCredentialView = { configured?: boolean; status?: string; verifiedAt?: string | null };
export type SalesSyncSettingsView = { enabled: boolean; syncFrequency: string; nextSyncAt: string | null };
export const SALES_SYNC_FREQUENCIES = { DAILY: "Una vez al día", EVERY_3_DAYS: "Cada 3 días", WEEKLY: "Una vez por semana", EVERY_15_DAYS: "Cada 15 días", MONTHLY: "Una vez al mes" };

export function SalesAutomaticSyncView({ credential, config, job, latestJob, busy, loading, error, onSync, onToggle, onFrequency }: {
  credential: SalesCredentialView | null; config: SalesSyncSettingsView | null; job: SyncJobView | null; latestJob: SyncJobView | null;
  busy: boolean; loading: boolean; error: string | null;
  onSync: () => void; onToggle: (enabled: boolean) => void; onFrequency: (frequency: string) => void;
}) {
  const active = latestJob && ["QUEUED", "RUNNING"].includes(latestJob.status) && !latestJob.resumable;
  const resume = job?.resumable && !active;
  return <section className="space-y-5">
    <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#1E52F1]">Ventas · SRI en línea</p><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Importación automática de ventas</h1><p className="mt-2 max-w-xl text-sm text-slate-500">Sincroniza tus comprobantes emitidos desde el SRI y consulta su progreso.</p></div>
      <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
        <Button onClick={onSync} disabled={busy || loading || !!active || !credential?.configured || credential.status === "INVALID"} className="bg-[#1E52F1] text-white shadow-sm hover:bg-[#1744cc]"><RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Preparando…" : resume ? "Reanudar sincronización" : "Sincronizar ahora"}</Button>
        <Button asChild variant="outline"><Link href="/facturacion/configuration?tab=sri"><Settings2 className="mr-2 h-4 w-4" />Configuración SRI</Link></Button>
        <Button asChild variant="outline"><Link href="/facturacion/sales/imports/sync-history"><History className="mr-2 h-4 w-4" />Ver historial</Link></Button>
      </div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-full ${credential?.configured && credential.status !== "INVALID" ? "bg-blue-50 text-[#1E52F1]" : "bg-slate-100 text-slate-500"}`}><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-900">{loading ? "Consultando configuración…" : salesCredentialLabel(credential)}</p><p className="mt-0.5 text-xs text-slate-500">{credential?.verifiedAt ? `Verificación guardada: ${new Date(credential.verifiedAt).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })}` : "Las credenciales se administran en Configuración SRI."}</p></div></div>
      <span className="inline-flex w-fit items-center gap-2 text-xs text-slate-600"><span className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-[#1E52F1]" : latestJob?.status === "SUCCEEDED" ? "bg-emerald-500" : "bg-slate-300"}`} />{salesSessionLabel(latestJob)}</span>
    </div>
    {job ? <SalesSyncProgressCard job={job} compact={!active} /> : <div className="rounded-xl border border-dashed border-slate-200 px-6 py-9 text-center"><ArrowRight className="mx-auto h-6 w-6 text-blue-500" /><p className="mt-3 text-sm font-medium text-slate-800">{loading ? "Consultando trabajos…" : "Todo listo para tu primera sincronización"}</p><p className="mt-1 text-xs text-slate-500">El primer trabajo parte del 1 de enero fiscal. Los siguientes continúan desde el progreso guardado.</p></div>}
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3"><summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"><SlidersHorizontal className="h-4 w-4 text-slate-400" />Programación automática</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="flex items-center justify-between gap-3 text-sm text-slate-600">Sincronización periódica<input type="checkbox" checked={config?.enabled ?? false} disabled={busy || loading || !credential?.configured} onChange={(event) => onToggle(event.target.checked)} className="h-4 w-4 accent-[#1E52F1]" /></label><div><label htmlFor="sales-sync-frequency" className="mb-1 block text-xs text-slate-500">Frecuencia</label><select id="sales-sync-frequency" value={config?.syncFrequency ?? "DAILY"} disabled={busy || loading || !credential?.configured} onChange={(event) => onFrequency(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">{Object.entries(SALES_SYNC_FREQUENCIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
      {config?.nextSyncAt && config.enabled && <p className="mt-3 text-xs text-slate-500">Próxima revisión: {new Date(config.nextSyncAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p>}
    </details>
  </section>;
}
