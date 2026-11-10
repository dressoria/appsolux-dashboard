"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  XCircle,
  AlertTriangle,
  Download,
  Search,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TransferRequest = {
  id: string;
  planCode: string;
  billingInterval: "MONTHLY" | "YEARLY";
  amountUsd: number;
  currency: string;
  bankReference: string;
  status: string;
  adminNote: string | null;
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
  tenant: { id: string; name: string; slug: string };
  requestedBy: { id: string; email: string; name: string | null };
  reviewedBy: { id: string; email: string; name: string | null } | null;
};

type StatusTab = "ALL" | "PENDING_REVIEW" | "ACTIVATION_FAILED" | "APPROVED" | "REJECTED";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "ALL", label: "Todas" },
  { key: "PENDING_REVIEW", label: "Pendientes" },
  { key: "ACTIVATION_FAILED", label: "Incidencias" },
  { key: "APPROVED", label: "Aprobadas" },
  { key: "REJECTED", label: "Rechazadas" },
];

const STATUS_BADGE: Record<string, { label: string; icon: typeof Clock3; className: string }> = {
  PENDING_REVIEW: { label: "Pendiente", icon: Clock3, className: "text-amber-600 bg-amber-50 border-amber-200" },
  APPROVED: { label: "Aprobada", icon: CheckCircle2, className: "text-green-600 bg-green-50 border-green-200" },
  REJECTED: { label: "Rechazada", icon: XCircle, className: "text-red-600 bg-red-50 border-red-200" },
  ACTIVATION_FAILED: { label: "Error activación", icon: AlertTriangle, className: "text-orange-600 bg-orange-50 border-orange-200" },
  INVOICING_PENDING: { label: "Facturación pend.", icon: Clock3, className: "text-blue-600 bg-blue-50 border-blue-200" },
  INVOICING_FAILED: { label: "Error facturación", icon: AlertTriangle, className: "text-orange-600 bg-orange-50 border-orange-200" },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function BankTransferAdminTable() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("PENDING_REVIEW");
  const [search, setSearch] = useState("");

  const [actionPanel, setActionPanel] = useState<{
    type: "approve" | "reject";
    request: TransferRequest;
  } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [fetchTrigger, setFetchTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (tab !== "ALL") params.set("status", tab);
      if (search.trim()) params.set("search", search.trim());
      try {
        const res = await fetch(`/api/admin/billing/bank-transfers?${params}`);
        const data = (await res.json()) as { ok: boolean; requests?: TransferRequest[] };
        if (!cancelled && data.ok && data.requests) setRequests(data.requests);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tab, search, fetchTrigger]);

  function refetch() {
    setFetchTrigger((n) => n + 1);
  }

  async function handleAction() {
    if (!actionPanel) return;
    setActionLoading(true);
    setActionError(null);

    const { type, request } = actionPanel;
    const endpoint = `/api/admin/billing/bank-transfers/${request.id}/${type}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: actionNote.trim() || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };

      if (!res.ok || !data.ok) {
        setActionError(data.message ?? "Error al procesar.");
        setActionLoading(false);
        return;
      }

      setActionPanel(null);
      setActionNote("");
      refetch();
    } catch {
      setActionError("Error de conexión.");
    } finally {
      setActionLoading(false);
    }
  }

  function openAction(type: "approve" | "reject", request: TransferRequest) {
    setActionPanel({ type, request });
    setActionNote("");
    setActionError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border bg-muted/50 p-1">
          {TABS.map((t) => (
            <button
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
                tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              key={t.key}
              onClick={() => setTab(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Buscar referencia, empresa, email…"
            value={search}
          />
        </div>
      </div>

      {actionPanel ? (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold">
                {actionPanel.type === "approve" ? "Aprobar transferencia" : "Rechazar transferencia"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {actionPanel.type === "approve"
                  ? `¿Confirmas la aprobación del pago de $${actionPanel.request.amountUsd} de ${actionPanel.request.tenant.name}? Se activará el plan ${actionPanel.request.planCode}.`
                  : `¿Confirmas el rechazo del pago de ${actionPanel.request.tenant.name}? Debes indicar el motivo.`}
              </p>
            </div>
            <button
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setActionPanel(null)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-note">
              {actionPanel.type === "approve" ? "Nota (opcional)" : "Motivo del rechazo *"}
            </Label>
            <Input
              id="admin-note"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActionNote(e.target.value)}
              placeholder={actionPanel.type === "approve" ? "Nota opcional…" : "Motivo del rechazo (obligatorio)…"}
              value={actionNote}
            />
          </div>
          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          <div className="flex gap-2">
            <Button disabled={actionLoading} onClick={() => setActionPanel(null)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={actionLoading || (actionPanel.type === "reject" && !actionNote.trim())}
              onClick={handleAction}
              variant={actionPanel.type === "approve" ? "default" : "destructive"}
            >
              {actionLoading
                ? "Procesando…"
                : actionPanel.type === "approve"
                  ? "Confirmar aprobación"
                  : "Confirmar rechazo"}
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No se encontraron solicitudes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Empresa</th>
                <th className="px-4 py-3 text-left font-semibold">Solicitante</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
                <th className="px-4 py-3 text-left font-semibold">Referencia</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const badge = STATUS_BADGE[req.status] ?? STATUS_BADGE.PENDING_REVIEW;
                const Icon = badge.icon;
                return (
                  <tr className="border-t" key={req.id}>
                    <td className="px-4 py-3 font-medium">{req.tenant.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{req.requestedBy.email}</td>
                    <td className="px-4 py-3">
                      {req.planCode} · {req.billingInterval === "MONTHLY" ? "Mensual" : "Anual"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">${req.amountUsd}</td>
                    <td className="px-4 py-3 font-mono text-xs">{req.bankReference}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          badge.className,
                        )}
                      >
                        <Icon className="size-3" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(req.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          title="Ver comprobante"
                        >
                          <a
                            href={`/api/admin/billing/bank-transfers/${req.id}/receipt`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="size-4" />
                          </a>
                        </Button>
                        {["PENDING_REVIEW", "ACTIVATION_FAILED"].includes(req.status) ? (
                          <>
                            <Button
                              onClick={() => openAction("approve", req)}
                              size="sm"
                              variant="default"
                            >
                              Aprobar
                            </Button>
                            <Button
                              onClick={() => openAction("reject", req)}
                              size="sm"
                              variant="destructive"
                            >
                              Rechazar
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
