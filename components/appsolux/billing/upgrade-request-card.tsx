"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type UpgradeRequest = {
  id: string;
  requestedPlanKey: string;
  currentPlanKey: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  message: string | null;
  adminNote: string | null;
  createdAt: Date | string;
  reviewedAt: Date | string | null;
};

type PlanKey = "free" | "trial" | "pro" | "enterprise";

function formatDate(value: Date | string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: UpgradeRequest["status"]) {
  if (status === "pending") {
    return "Solicitud en revision";
  }

  if (status === "approved") {
    return "Solicitud aprobada";
  }

  if (status === "rejected") {
    return "Solicitud rechazada";
  }

  return "Solicitud cancelada";
}

function getAvailableTargets(planKey: PlanKey) {
  if (planKey === "enterprise") {
    return [];
  }

  if (planKey === "pro") {
    return ["enterprise"] as const;
  }

  return ["pro", "enterprise"] as const;
}

export function UpgradeRequestCard({
  planKey,
  requests,
}: {
  planKey: PlanKey;
  requests: UpgradeRequest[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const pendingRequest = requests.find((request) => request.status === "pending");
  const targets = getAvailableTargets(planKey);

  async function submitRequest(requestedPlanKey: "pro" | "enterprise") {
    setFeedback(null);
    const response = await fetch("/api/billing/upgrade-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedPlanKey,
        message,
      }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !payload.ok) {
      setFeedback(payload.message ?? "No se pudo enviar la solicitud.");
      return;
    }

    setMessage("");
    setFeedback("Solicitud enviada.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-4">
        <p className="font-medium">Solicitud de mejora de plan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Durante la beta, Appsolux revisara tu solicitud y activara el plan
          manualmente. No hay pago automatico conectado todavia.
        </p>

        {pendingRequest ? (
          <div className="mt-3 rounded-md border bg-background p-3 text-sm">
            <p className="font-medium">Solicitud en revision</p>
            <p className="text-muted-foreground">
              Plan solicitado: {pendingRequest.requestedPlanKey}. Enviada el{" "}
              {formatDate(pendingRequest.createdAt)}.
            </p>
          </div>
        ) : targets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ya tienes el plan mas alto disponible para beta.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <textarea
              className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
              value={message}
              maxLength={1000}
              placeholder="Mensaje opcional para el equipo Appsolux"
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {targets.map((target) => (
                <Button
                  key={target}
                  type="button"
                  disabled={isPending}
                  onClick={() => void submitRequest(target)}
                >
                  Solicitar {target === "pro" ? "Pro" : "Enterprise"}
                </Button>
              ))}
            </div>
          </div>
        )}

        {feedback ? (
          <p className="mt-3 text-sm text-muted-foreground">{feedback}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Solicitudes recientes</p>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavia no has solicitado mejora de plan.
          </p>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{statusLabel(request.status)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(request.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-muted-foreground">
                {request.currentPlanKey ?? "plan actual"} a{" "}
                {request.requestedPlanKey}
              </p>
              {request.message ? <p className="mt-2">{request.message}</p> : null}
              {request.adminNote ? (
                <p className="mt-2 text-muted-foreground">
                  Nota Appsolux: {request.adminNote}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
