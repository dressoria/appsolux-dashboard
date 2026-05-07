"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type UpgradeRequestRow = {
  id: string;
  requestedPlanKey: string;
  currentPlanKey: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  message: string | null;
  adminNote: string | null;
  createdAt: Date | string;
  reviewedAt: Date | string | null;
  tenant: {
    name: string;
    slug: string;
    planKey: string | null;
  };
  requestedBy: {
    name: string;
    email: string;
  } | null;
  reviewedBy: {
    name: string;
    email: string;
  } | null;
};

function formatDate(value: Date | string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function UpgradeRequestsTable({
  requests,
}: {
  requests: UpgradeRequestRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    setMessage(null);
    const response = await fetch(
      `/api/admin/billing/upgrade-requests/${requestId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          adminNote: notes[requestId] ?? "",
        }),
      }
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "No se pudo revisar la solicitud.");
      return;
    }

    setMessage(action === "approve" ? "Solicitud aprobada." : "Solicitud rechazada.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Tenant</th>
              <th className="px-3 py-2 font-medium">Solicitante</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Mensaje</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Nota admin</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t align-top">
                <td className="px-3 py-3">
                  <p className="font-medium">{request.tenant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.tenant.slug}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p>{request.requestedBy?.name ?? "Sin usuario"}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.requestedBy?.email ?? "Sin email"}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p>
                    {request.currentPlanKey ?? request.tenant.planKey ?? "free"} a{" "}
                    {request.requestedPlanKey}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
                  </p>
                </td>
                <td className="max-w-xs px-3 py-3 text-muted-foreground">
                  {request.message ?? "Sin mensaje"}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">{request.status}</p>
                  <p className="text-xs text-muted-foreground">
                    Revisado: {formatDate(request.reviewedAt)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  {request.status === "pending" ? (
                    <textarea
                      className="min-h-16 w-64 rounded-md border bg-background p-2 text-sm"
                      value={notes[request.id] ?? ""}
                      maxLength={1000}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    <p className="max-w-xs text-muted-foreground">
                      {request.adminNote ?? "Sin nota"}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3">
                  {request.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={() => void reviewRequest(request.id, "approve")}
                      >
                        Aprobar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => void reviewRequest(request.id, "reject")}
                      >
                        Rechazar
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Revisado por {request.reviewedBy?.email ?? "admin"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay solicitudes de upgrade todavia.
        </p>
      ) : null}
    </div>
  );
}
