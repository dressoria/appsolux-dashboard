"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ChecklistItemStatus = "PASS" | "WARN" | "FAIL";

type ChecklistItem = {
  key: string;
  label: string;
  status: ChecklistItemStatus;
};

type ChecklistResult = {
  status: "BLOCKED" | "WARNING" | "READY";
  blockingIssues: string[];
  warnings: string[];
  passedChecks: string[];
  displayNumber: string | null;
  accessKey: string | null;
  numberingPersisted: boolean;
  items: ChecklistItem[];
};

type Props = {
  documentId: string;
  documentStatus: string;
};

const CHECKLIST_ACTIONS: Partial<Record<string, { href: string; label: string }>> = {
  profile_exists: { href: "/sri/company", label: "Configurar empresa / RUC" },
  ruc_valid: { href: "/sri/company", label: "Revisar RUC" },
  legal_name: { href: "/sri/company", label: "Revisar razon social" },
  establishment: { href: "/sri/establishments", label: "Revisar establecimiento" },
  issue_point: { href: "/sri/issue-points", label: "Revisar punto de emision" },
  sequence: { href: "/sri/sequences", label: "Revisar secuencial" },
};

function ItemIcon({ status }: { status: ChecklistItemStatus }) {
  if (status === "PASS") return <span className="text-emerald-600 font-bold">✓</span>;
  if (status === "WARN") return <span className="text-amber-500 font-bold">!</span>;
  return <span className="text-red-600 font-bold">✗</span>;
}

function itemRowClass(status: ChecklistItemStatus): string {
  if (status === "PASS") return "text-emerald-800";
  if (status === "WARN") return "text-amber-700";
  return "text-red-700";
}

export function SriTechnicalChecklistSection({ documentId, documentStatus }: Props) {
  const router = useRouter();

  // Derive loading from both being null — avoids synchronous setState in effect
  const [result, setResult] = useState<ChecklistResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const loading = result === null && fetchError === null;

  const [retryCount, setRetryCount] = useState(0);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/sri/documents/${documentId}/technical-checklist`)
      .then(async (res) => {
        const data = (await res.json()) as { error?: string } & Partial<ChecklistResult>;
        if (!res.ok) throw new Error(data.error ?? "Error al cargar checklist.");
        return data as ChecklistResult;
      })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setFetchError(e instanceof Error ? e.message : "Error de red.");
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, retryCount]);

  function handleRetry() {
    setResult(null);
    setFetchError(null);
    setRetryCount((c) => c + 1);
  }

  async function handleMarkReady() {
    setMarking(true);
    setMarkError(null);
    try {
      const res = await fetch(`/api/sri/documents/${documentId}/mark-ready`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; blockingIssues?: string[] };
      if (!res.ok) {
        const details =
          data.blockingIssues && data.blockingIssues.length > 0
            ? ` ${data.blockingIssues.join(" ")}`
            : "";
        throw new Error((data.error ?? "Error al marcar como listo.") + details);
      }
      router.refresh();
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : "Error de red.");
    } finally {
      setMarking(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Verificando requisitos técnicos...</p>;
  }

  if (fetchError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{fetchError}</p>
        <Button size="sm" variant="outline" onClick={handleRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!result) return null;

  const canMarkReady = documentStatus === "DRAFT" && result.blockingIssues.length === 0;
  const actionLinks = Array.from(
    new Map(
      result.items
        .filter((item) => item.status === "FAIL")
        .map((item) => [item.key, CHECKLIST_ACTIONS[item.key]])
        .filter((entry): entry is [string, { href: string; label: string }] => Boolean(entry[1]))
    ).values()
  );

  const statusBanner = {
    READY: "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800",
    WARNING: "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800",
    BLOCKED: "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800",
  }[result.status];

  const statusLabel = {
    READY: documentStatus === "DRAFT"
      ? "Listo — el comprobante puede marcarse como listo para pruebas."
      : "Verificacion tecnica OK — el comprobante puede firmarse.",
    WARNING: documentStatus === "DRAFT"
      ? "Listo con advertencias — puede continuar, pero revisa los puntos marcados con !"
      : "Advertencias — pueden continuar, pero revisa los puntos marcados con !",
    BLOCKED: "Bloqueado — resuelve los errores antes de firmar.",
  }[result.status];

  return (
    <div className="space-y-4">
      <div className={statusBanner}>
        <p className="font-semibold">{statusLabel}</p>
        <p className="mt-0.5 text-xs opacity-80">
          Este checklist verifica la estructura técnica del comprobante. No firma ni envía al SRI.
        </p>
      </div>

      {result.displayNumber && (
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Número</span>
            <p className="font-mono font-semibold">{result.displayNumber}</p>
          </div>
          {result.accessKey && (
            <div className="flex-1 min-w-0">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {result.numberingPersisted ? "Clave de acceso persistida" : "Clave de acceso candidata"}
              </span>
              <p className="font-mono text-xs break-all text-slate-700 leading-relaxed mt-0.5">
                {result.accessKey}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.numberingPersisted
                  ? "Reservada para este comprobante. Aun no firmada ni autorizada."
                  : "Vista previa local. Aun no reservada para este comprobante."}
              </p>
            </div>
          )}
        </div>
      )}

      <ul className="space-y-1.5">
        {result.items.map((item) => (
          <li key={item.key} className={`flex gap-2 text-sm ${itemRowClass(item.status)}`}>
            <ItemIcon status={item.status} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {result.blockingIssues.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-700">Errores bloqueantes:</p>
          <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
            {result.blockingIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {actionLinks.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Pasos recomendados para desbloquear:</p>
          <div className="flex flex-wrap gap-2">
            {actionLinks.map((action) => (
              <Button key={action.href} asChild size="sm" variant="outline">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {documentStatus === "DRAFT" && (
        <div className="space-y-2 pt-1">
          <Button
            size="sm"
            onClick={() => void handleMarkReady()}
            disabled={!canMarkReady || marking}
            variant={canMarkReady ? "default" : "outline"}
          >
            {marking ? "Marcando..." : "Marcar listo para pruebas"}
          </Button>
          {!canMarkReady && result.blockingIssues.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Resuelve los errores bloqueantes para habilitar esta acción.
            </p>
          )}
          {markError && <p className="text-xs text-destructive">{markError}</p>}
        </div>
      )}

      {documentStatus === "READY_FOR_TESTING" && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          Este comprobante esta marcado como listo para pruebas. Ya puede solicitar firma, pero todavia no esta autorizado por el SRI.
        </p>
      )}
    </div>
  );
}
