"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SyncProgressCard } from "@/components/appsolux/sri-tax/sync-progress-card";
import { useSyncJobs } from "@/components/appsolux/sri-tax/use-sync-jobs";
import { connectionLabel } from "@/lib/core/sri-sync-presentation";

type CredentialInfo = { configured: boolean; status?: string; usernameMasked?: string; verifiedAt?: string | null; lastVerificationErrorSafe?: string | null };
type SyncStatus = { lastSuccessfulSyncAt: string | null; nextSyncAt: string | null; lastError: string | null };

export function AutomaticDownloadClient() {
  const progress = useSyncJobs("/api/purchases/sri-sync/jobs?page=1&pageSize=20");
  const [cred, setCred] = useState<CredentialInfo | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importFrom, setImportFrom] = useState(() => `${new Intl.DateTimeFormat("en", { timeZone: "America/Guayaquil", year: "numeric" }).format(new Date())}-01-01`);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    Promise.all([
      fetch("/api/purchases/sri-credentials", { cache: "no-store", signal }),
      fetch("/api/purchases/sri-sync/status", { cache: "no-store", signal }),
    ]).then(async ([credRes, syncRes]) => {
      if (!credRes.ok || !syncRes.ok) throw new Error("No se pudo consultar la configuración SRI.");
      return Promise.all([credRes.json(), syncRes.json()]);
    }).then(([credential, status]) => {
      if (!signal.aborted) { setCred(credential); setSync(status); }
    }).catch((err: unknown) => {
      if (!signal.aborted) setError(err instanceof Error ? err.message : "Error de conexión.");
    });
    return () => controller.abort();
  }, [progress.job?.status]);

  async function handleSyncNow() {
    setSyncing(true); setError(null);
    try {
      const response = await fetch("/api/purchases/sri-sync/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dateFrom: importFrom }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "No se pudo iniciar la sincronización.");
      if (data.job) progress.trackJob(data.job);
      await progress.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error de conexión."); }
    finally { setSyncing(false); }
  }

  const active = ["QUEUED", "RUNNING"].includes(progress.job?.status ?? "");
  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Importación automática de compras</h1>
      <p className="mt-1 text-sm text-muted-foreground">Consulta de comprobantes recibidos en el SRI. La validación real del conector de recibidos está pendiente.</p>
    </div>
    {(error || progress.error) && <p role="alert" className="rounded border border-red-200 p-3 text-sm text-red-700">{error || progress.error}</p>}
    <Card><CardContent className="space-y-3 p-6">
      <p className="font-medium" aria-live="polite">{connectionLabel(cred?.status, progress.job, cred?.verifiedAt)}</p>
      {cred?.usernameMasked && <p className="text-sm text-muted-foreground">Usuario configurado: {cred.usernameMasked}</p>}
      <Link className="text-sm text-blue-700 underline" href="/facturacion/configuration?tab=sri">Configurar credenciales en Empresa → Configuración → SRI</Link>
      {cred?.lastVerificationErrorSafe && <p className="text-sm text-red-700">{cred.lastVerificationErrorSafe}</p>}
      {sync?.lastSuccessfulSyncAt && <p className="text-sm">Última sincronización exitosa: {new Date(sync.lastSuccessfulSyncAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p>}
      {sync?.nextSyncAt && <p className="text-sm">Próxima sincronización: {new Date(sync.nextSyncAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p>}
      {sync?.lastError && <p className="text-sm text-red-700">{sync.lastError}</p>}
    </CardContent></Card>
    {progress.job && <SyncProgressCard job={progress.job} title="Último intento de sincronización de compras" />}
    {progress.loading && <p className="text-sm text-muted-foreground">Consultando trabajos...</p>}
    <Card><CardContent className="space-y-4 p-6">
      <h2 className="font-medium">Sincronizar ahora</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><label htmlFor="purchases-import-from" className="text-xs text-muted-foreground">Importar comprobantes desde</label><Input id="purchases-import-from" type="date" value={importFrom} onChange={(e) => setImportFrom(e.target.value)} className="w-44" /></div>
        <Button onClick={handleSyncNow} disabled={syncing || active || cred?.status !== "VERIFIED" || !importFrom}>{syncing ? "Iniciando..." : "Sincronizar ahora"}</Button>
      </div>
    </CardContent></Card>
    <details className="rounded border p-4"><summary className="cursor-pointer text-sm font-medium">Historial de compras (últimos 20 intentos)</summary>
      <div className="mt-3 space-y-3">{progress.jobs.map((job) => <SyncProgressCard key={job.id} job={job} title={job.type === "VERIFY_CONNECTION" ? "Verificación de conexión" : "Sincronización de compras"} />)}{!progress.loading && progress.jobs.length === 0 && <p className="text-sm">No hay trabajos registrados.</p>}</div>
    </details>
  </div>;
}
