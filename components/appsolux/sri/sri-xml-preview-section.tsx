"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type XmlPreviewState =
  | { phase: "idle" }
  | { phase: "loading" }
  | {
      phase: "done";
      xml: string;
      displayNumber: string;
      warnings: string[];
      missingFields: string[];
    }
  | { phase: "error"; message: string };

type Props = { documentId: string };

export function SriXmlPreviewSection({ documentId }: Props) {
  const [state, setState] = useState<XmlPreviewState>({ phase: "idle" });
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/sri/documents/${documentId}/xml-preview`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        xml?: string;
        displayNumber?: string;
        warnings?: string[];
        missingFields?: string[];
        error?: string;
      };
      if (!res.ok || !data.xml) {
        setState({ phase: "error", message: data.error ?? "Error al generar vista previa." });
        return;
      }
      setState({
        phase: "done",
        xml: data.xml,
        displayNumber: data.displayNumber ?? "",
        warnings: data.warnings ?? [],
        missingFields: data.missingFields ?? [],
      });
    } catch {
      setState({ phase: "error", message: "Error de red. Intenta de nuevo." });
    }
  }

  async function handleCopy(xml: string) {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available in all environments
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
        Este XML es preliminar, no está firmado y{" "}
        <span className="font-semibold">no tiene validez tributaria.</span>{" "}
        Es solo una previsualización interna de la estructura del comprobante.
      </div>

      {state.phase === "idle" && (
        <Button size="sm" onClick={handleGenerate}>
          Generar vista previa XML
        </Button>
      )}

      {state.phase === "loading" && (
        <Button size="sm" disabled>
          Generando...
        </Button>
      )}

      {state.phase === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button size="sm" variant="outline" onClick={() => setState({ phase: "idle" })}>
            Reintentar
          </Button>
        </div>
      )}

      {state.phase === "done" && (
        <div className="space-y-3">
          {state.displayNumber && (
            <p className="font-mono text-sm font-medium">
              Número interno: <span className="text-slate-700">{state.displayNumber}</span>
            </p>
          )}

          {state.missingFields.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700">Errores de validación:</p>
              <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                {state.missingFields.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {state.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">Advertencias:</p>
              <ul className="list-disc list-inside text-xs text-amber-600 space-y-0.5">
                {state.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerate}>
              Regenerar
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleCopy(state.xml)}>
              {copied ? "Copiado" : "Copiar XML"}
            </Button>
          </div>

          <pre className="max-h-96 overflow-x-auto overflow-y-auto rounded-md border bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
            {state.xml}
          </pre>
        </div>
      )}
    </div>
  );
}
