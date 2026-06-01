"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type SignState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "not_available"; message: string }
  | { phase: "error"; message: string };

type Props = { documentId: string };

export function SriSignPreviewButton({ documentId }: Props) {
  const [state, setState] = useState<SignState>({ phase: "idle" });

  async function handleAttempt() {
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/sri/documents/${documentId}/sign-preview`, {
        method: "POST",
      });
      const data = (await res.json()) as { ready?: boolean; message?: string; error?: string };

      if (res.status === 501 || (data.ready === false && data.message)) {
        setState({
          phase: "not_available",
          message: data.message ?? "Firma electrónica no habilitada todavía.",
        });
        return;
      }

      if (!res.ok) {
        setState({ phase: "error", message: data.error ?? "Error al intentar firma." });
        return;
      }

      // ok: true — no alcanzable en esta fase
      setState({ phase: "idle" });
    } catch {
      setState({ phase: "error", message: "Error de red. Intenta de nuevo." });
    }
  }

  return (
    <div className="space-y-2">
      {state.phase === "idle" && (
        <Button size="sm" variant="outline" onClick={() => void handleAttempt()}>
          Intentar firma de prueba
        </Button>
      )}

      {state.phase === "loading" && (
        <Button size="sm" variant="outline" disabled>
          Verificando...
        </Button>
      )}

      {state.phase === "not_available" && (
        <div className="space-y-2">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-semibold">Firma electrónica real no habilitada</p>
            <p className="mt-0.5 text-xs">{state.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setState({ phase: "idle" })}>
            Entendido
          </Button>
        </div>
      )}

      {state.phase === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button size="sm" variant="outline" onClick={() => setState({ phase: "idle" })}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
