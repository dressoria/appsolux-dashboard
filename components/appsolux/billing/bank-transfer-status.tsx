"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, XCircle, AlertTriangle, Loader2 } from "lucide-react";
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
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock3; className: string }> = {
  PENDING_REVIEW: { label: "Pendiente de revisión", icon: Clock3, className: "text-amber-600 bg-amber-50 border-amber-200" },
  APPROVED: { label: "Aprobada", icon: CheckCircle2, className: "text-green-600 bg-green-50 border-green-200" },
  REJECTED: { label: "Rechazada", icon: XCircle, className: "text-red-600 bg-red-50 border-red-200" },
  ACTIVATION_FAILED: { label: "Error de activación", icon: AlertTriangle, className: "text-orange-600 bg-orange-50 border-orange-200" },
  INVOICING_PENDING: { label: "Facturación pendiente", icon: Clock3, className: "text-blue-600 bg-blue-50 border-blue-200" },
  INVOICING_FAILED: { label: "Error de facturación", icon: AlertTriangle, className: "text-orange-600 bg-orange-50 border-orange-200" },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(iso));
}

export function BankTransferStatus() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/billing/bank-transfer/status");
        const data = (await res.json()) as { ok: boolean; requests?: TransferRequest[] };
        if (!cancelled && data.ok && data.requests) {
          setRequests(data.requests);
        }
      } catch {
        // silent — non-critical display component
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando solicitudes…
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Solicitudes de transferencia</h3>
      <div className="space-y-3">
        {requests.map((req) => {
          const config = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.PENDING_REVIEW;
          const Icon = config.icon;
          return (
            <div
              className="rounded-2xl border bg-card p-5"
              key={req.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    Plan {req.planCode} — {req.billingInterval === "MONTHLY" ? "Mensual" : "Anual"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ${req.amountUsd} {req.currency} · Ref: {req.bankReference}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enviada el {formatDate(req.createdAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                    config.className,
                  )}
                >
                  <Icon className="size-3.5" />
                  {config.label}
                </span>
              </div>

              {req.status === "APPROVED" && req.subscriptionStartsAt && req.subscriptionEndsAt ? (
                <p className="mt-3 text-sm text-green-700">
                  Plan activo desde {formatDate(req.subscriptionStartsAt)} hasta {formatDate(req.subscriptionEndsAt)}.
                </p>
              ) : null}

              {req.status === "REJECTED" && req.adminNote ? (
                <p className="mt-3 text-sm text-red-700">
                  Motivo: {req.adminNote}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
