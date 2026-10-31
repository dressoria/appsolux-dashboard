"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SyncProgressCard, type SyncJobProgress } from "@/components/appsolux/sri-tax/sync-progress-card";

type CredentialInfo = {
  configured: boolean;
  usernameMasked?: string;
  additionalUserConfigured?: boolean;
  status?: string;
  verifiedAt?: string | null;
  lastVerificationAt?: string | null;
  lastVerificationErrorSafe?: string | null;
};

type SyncStatus = {
  configured: boolean;
  credentialStatus: string | null;
  syncStatus: string;
  activeJob: SyncJobProgress | null;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  lastResult: {
    documentsFound: number;
    documentsImported: number;
    documentsSkipped: number;
    finishedAt: string | null;
  } | null;
};

type Step = "welcome" | "credentials" | "verifying" | "active";

function resolveStep(cred: CredentialInfo | null, sync: SyncStatus | null): Step {
  if (!cred || !cred.configured) return "welcome";
  if (cred.status === "PENDING_VERIFICATION") return "verifying";
  if (cred.status === "VERIFIED" && sync?.syncStatus === "ACTIVE") return "active";
  if (cred.status === "INVALID" || cred.status === "ERROR" || cred.status === "HUMAN_VERIFICATION_REQUIRED") return "credentials";
  if (sync?.activeJob && ["QUEUED", "RUNNING"].includes(sync.activeJob.status)) return "verifying";
  if (cred.status === "VERIFIED") return "active";
  return "credentials";
}

export function AutomaticDownloadClient() {
  const [cred, setCred] = useState<CredentialInfo | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("welcome");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [additionalUser, setAdditionalUser] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  const [verifyJobId, setVerifyJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const [syncing, setSyncing] = useState(false);
  const [importFrom, setImportFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });

  const [deactivating, setDeactivating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [credRes, syncRes] = await Promise.all([
      fetch("/api/purchases/sri-credentials"),
      fetch("/api/purchases/sri-sync/status"),
    ]);
    const credData: CredentialInfo = await credRes.json();
    const syncData: SyncStatus = await syncRes.json();
    setCred(credData);
    setSync(syncData);
    setStep(resolveStep(credData, syncData));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll().then(() => {
      // Will be checked after state is set via the effect below
    });
  }, [fetchAll]);

  useEffect(() => {
    if (
      sync?.activeJob &&
      ["QUEUED", "RUNNING"].includes(sync.activeJob.status) &&
      step === "active" &&
      !pollRef.current
    ) {
      startSyncPolling();
    }
  }, [sync?.activeJob?.status, step]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(jobId: string) {
    setVerifyJobId(jobId);
    setStep("verifying");
    pollCountRef.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 60) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      const res = await fetch("/api/purchases/sri-sync/status");
      const data: SyncStatus = await res.json();
      setSync(data);
      const credRes = await fetch("/api/purchases/sri-credentials");
      const credData: CredentialInfo = await credRes.json();
      setCred(credData);
      const resolved = resolveStep(credData, data);
      if (resolved !== "verifying") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStep(resolved);
      }
    }, 4000);
  }

  async function handleSaveCredentials() {
    setSaving(true);
    setCredError(null);
    try {
      const res = await fetch("/api/purchases/sri-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          additionalUserId: showAdditional ? additionalUser.trim() || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCredError(data.error || "Error al guardar credenciales.");
        return;
      }
      startPolling(data.jobId);
    } catch {
      setCredError("Error de red al guardar credenciales.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    await fetch("/api/purchases/sri-sync/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateFrom: importFrom }),
    });
    setSyncing(false);
    await fetchAll();
    startSyncPolling();
  }

  function startSyncPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 180) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      const res = await fetch("/api/purchases/sri-sync/status");
      const data: SyncStatus = await res.json();
      setSync(data);
      if (!data.activeJob || !["QUEUED", "RUNNING"].includes(data.activeJob.status)) {
        if (pollRef.current) clearInterval(pollRef.current);
        fetchAll();
      }
    }, 5000);
  }

  async function handleDeactivate() {
    setDeactivating(true);
    await fetch("/api/purchases/sri-credentials", { method: "DELETE" });
    setDeactivating(false);
    setStep("welcome");
    fetchAll();
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8">Cargando...</div>;
  }

  if (step === "welcome") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Activa la recepción automática de tus comprobantes de compra
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Facturom puede consultar los comprobantes recibidos en tu cuenta del SRI
            y organizarlos automáticamente en tu bandeja de compras.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Descarga automática", desc: "Tus comprobantes recibidos se importan periódicamente desde el SRI." },
            { title: "Organización inteligente", desc: "Los documentos se clasifican y organizan en tu bandeja de compras." },
            { title: "Menos registro manual", desc: "Reduce el ingreso manual de facturas de proveedores." },
          ].map((c) => (
            <Card key={c.title}>
              <CardContent className="p-5">
                <h3 className="font-medium text-sm">{c.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button onClick={() => setStep("credentials")}>Comenzar activación</Button>
      </div>
    );
  }

  if (step === "credentials") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conexión al SRI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa las credenciales de tu cuenta en SRI en Línea.
          </p>
        </div>
        {cred?.status === "INVALID" && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            Las credenciales fueron rechazadas por el SRI. Verifícalas e intenta nuevamente.
          </div>
        )}
        {cred?.status === "HUMAN_VERIFICATION_REQUIRED" && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            El SRI solicita una verificación adicional. Actualiza o verifica tu acceso para continuar.
          </div>
        )}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Usuario / RUC SRI</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="1793XXXXXXX001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña SRI</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAdditional}
                onChange={(e) => setShowAdditional(e.target.checked)}
                className="rounded border"
              />
              Usar usuario adicional
            </label>
            {showAdditional && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Usuario adicional</label>
                <Input
                  value={additionalUser}
                  onChange={(e) => setAdditionalUser(e.target.value)}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Tus credenciales se almacenan cifradas y se utilizan únicamente para conectarse al portal del SRI.
            </p>
            {credError && (
              <p className="text-sm text-destructive">{credError}</p>
            )}
            <div className="flex gap-3">
              <Button onClick={handleSaveCredentials} disabled={saving || !username.trim() || !password}>
                {saving ? "Verificando..." : "Verificar conexión"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("welcome")}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "verifying") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verificando conexión</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estamos verificando tu conexión con el SRI.
          </p>
        </div>
        {sync?.activeJob ? (
          <SyncProgressCard job={sync.activeJob} title="Verificación de conexión" />
        ) : (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm">Verificación en progreso...</span>
              </div>
              {verifyJobId && (
                <p className="text-xs text-muted-foreground">Job: {verifyJobId}</p>
              )}
            </CardContent>
          </Card>
        )}
        <p className="text-xs text-muted-foreground">
          Esto puede tomar unos momentos. La página se actualizará automáticamente.
        </p>
      </div>
    );
  }

  // step === "active"
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Descarga automática SRI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La recepción automática de comprobantes está activa.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="font-medium text-sm">Descarga automática activa</span>
            {cred?.status === "HUMAN_VERIFICATION_REQUIRED" && (
              <span className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                CAPTCHA requerido
              </span>
            )}
          </div>
          {cred?.status === "HUMAN_VERIFICATION_REQUIRED" && (
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              El SRI está solicitando verificación manual (CAPTCHA). Actualiza tus credenciales para re-verificar la conexión.
            </p>
          )}
          {cred?.usernameMasked && (
            <p className="text-sm text-muted-foreground">
              Usuario configurado: {cred.usernameMasked}
            </p>
          )}
          {sync?.activeJob && ["QUEUED", "RUNNING"].includes(sync.activeJob.status) && (
            <div className="pt-1">
              <SyncProgressCard job={sync.activeJob} title="Sincronización en curso" />
            </div>
          )}
          {sync?.lastSuccessfulSyncAt && (
            <p className="text-sm text-muted-foreground">
              Última sincronización exitosa:{" "}
              {new Date(sync.lastSuccessfulSyncAt).toLocaleString("es-EC")}
            </p>
          )}
          {sync?.nextSyncAt && (
            <p className="text-sm text-muted-foreground">
              Próxima sincronización:{" "}
              {new Date(sync.nextSyncAt).toLocaleString("es-EC")}
            </p>
          )}
          {sync?.lastResult && (
            <div className="text-sm text-muted-foreground">
              Último resultado: {sync.lastResult.documentsImported} importados,{" "}
              {sync.lastResult.documentsSkipped} omitidos
            </div>
          )}
          {sync?.lastError && (
            <p className="text-sm text-destructive">Error: {sync.lastError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-medium text-sm">Sincronizar ahora</h3>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Importar comprobantes desde</label>
              <Input
                type="date"
                value={importFrom}
                onChange={(e) => setImportFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={handleSyncNow} disabled={syncing}>
              {syncing ? "Iniciando..." : "Sincronizar ahora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-medium text-sm">Opciones</h3>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("credentials")}>
              Actualizar credenciales
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? "Desactivando..." : "Desactivar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
