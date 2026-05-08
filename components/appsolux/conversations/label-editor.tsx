"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const SUGGESTED_LABELS = [
  "pago-pendiente",
  "por-validar",
  "pendiente-despacho",
  "despachado",
  "cliente-frecuente",
  "mayorista",
  "reclamo",
  "vip",
  "no-responder",
  "interesado",
] as const;

function formatLabel(label: string): string {
  return label
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type LabelEditorProps = {
  conversationId: number;
  currentLabels: string[];
  onLabelsChange: (newLabels: string[]) => void;
};

export function LabelEditor({
  conversationId,
  currentLabels,
  onLabelsChange,
}: LabelEditorProps) {
  const [labels, setLabels] = useState<string[]>(currentLabels);
  const [accountLabels, setAccountLabels] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [addState, setAddState] = useState<"idle" | "loading">("idle");
  const [addError, setAddError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLabels(currentLabels);
  }, [currentLabels, conversationId]);

  useEffect(() => {
    async function loadAccountLabels() {
      try {
        const response = await fetch("/api/conversations/labels");
        const payload = (await response.json()) as {
          success: boolean;
          data?: { labels: string[] };
        };

        if (response.ok && payload.success && payload.data) {
          setAccountLabels(payload.data.labels);
        }
      } catch {
        // non-fatal: suggested labels still available
      }
    }

    void loadAccountLabels();
  }, []);

  useEffect(() => {
    if (!popoverOpen) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [popoverOpen]);

  async function applyLabels(newLabels: string[]) {
    setAddState("loading");
    setAddError("");

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/labels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labels: newLabels }),
        }
      );
      const payload = (await response.json()) as {
        success: boolean;
        data?: { labels: string[] };
        error?: { message: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error?.message ?? "No se pudieron aplicar las etiquetas."
        );
      }

      const updated = payload.data?.labels ?? newLabels;
      setLabels(updated);
      onLabelsChange(updated);
    } catch (error) {
      setAddError(
        error instanceof Error
          ? error.message
          : "No se pudieron aplicar las etiquetas."
      );
    } finally {
      setAddState("idle");
    }
  }

  function addLabel(label: string) {
    setPopoverOpen(false);

    if (labels.includes(label)) {
      return;
    }

    void applyLabels([...labels, label]);
  }

  function removeLabel(label: string) {
    void applyLabels(labels.filter((l) => l !== label));
  }

  const availableToAdd = Array.from(
    new Set([...SUGGESTED_LABELS, ...accountLabels])
  ).filter((label) => !labels.includes(label));

  return (
    <div className="space-y-3">
      {labels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
            >
              {formatLabel(label)}
              <button
                type="button"
                aria-label={`Quitar ${formatLabel(label)}`}
                disabled={addState === "loading"}
                className="ml-0.5 rounded-full leading-none hover:text-destructive disabled:opacity-50"
                onClick={() => removeLabel(label)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin etiquetas.</p>
      )}

      <div className="relative" ref={popoverRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={addState === "loading"}
          onClick={() => setPopoverOpen((v) => !v)}
        >
          {addState === "loading" ? "Aplicando..." : "Agregar etiqueta"}
        </Button>

        {popoverOpen ? (
          <div className="absolute left-0 top-9 z-20 w-56 rounded-xl border bg-background p-2 shadow-xl">
            {availableToAdd.length > 0 ? (
              availableToAdd.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => addLabel(label)}
                >
                  {formatLabel(label)}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Todas las etiquetas están aplicadas.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {addError ? (
        <p className="text-xs text-destructive">{addError}</p>
      ) : null}
    </div>
  );
}
