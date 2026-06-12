"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  saleId: string;
};

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | {
      phase: "done";
      documentId: string;
      alreadyExisted: boolean;
      flowLabel: string;
      message: string;
    }
  | { phase: "error"; message: string };

export function CreateSriDraftFromSaleButton({ saleId }: Props) {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function handleCreate() {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/sri/documents/from-basic-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId }),
      });
      const data = (await res.json()) as {
        documentId?: string;
        alreadyExists?: boolean;
        flowLabel?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.documentId) {
        setState({ phase: "error", message: data.error ?? "Error al crear borrador." });
        return;
      }
      setState({
        phase: "done",
        documentId: data.documentId,
        alreadyExisted: data.alreadyExists ?? false,
        flowLabel: data.flowLabel ?? "Preparando",
        message: data.message ?? "Se inicio el flujo SRI.",
      });
    } catch {
      setState({ phase: "error", message: "Error de red. Intenta de nuevo." });
    }
  }

  if (state.phase === "done") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-emerald-700">
          {state.alreadyExisted
            ? "Ya existe un documento SRI para esta venta."
            : state.message}
        </p>
        <p className="text-xs text-muted-foreground">Estado actual: {state.flowLabel}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/sri/documents/${state.documentId}`}>Abrir documento SRI</Link>
        </Button>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{state.message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setState({ phase: "idle" })}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleCreate}
      disabled={state.phase === "loading"}
    >
      {state.phase === "loading" ? "Preparando..." : "Emitir factura electronica"}
    </Button>
  );
}
