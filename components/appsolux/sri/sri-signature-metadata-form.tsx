"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type FormState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success" }
  | { phase: "error"; message: string };

export function SriSignatureMetadataForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ phase: "idle" });
  const [open, setOpen] = useState(false);

  const [certificateFileName, setCertificateFileName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [fingerprintSha256, setFingerprintSha256] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ phase: "loading" });

    try {
      const res = await fetch("/api/sri/signature/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateFileName,
          expiresAt,
          issuerName: issuerName || undefined,
          subjectName: subjectName || undefined,
          serialNumber: serialNumber || undefined,
          fingerprintSha256: fingerprintSha256 || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setState({ phase: "error", message: data.error ?? "Error al guardar metadata." });
        return;
      }

      setState({ phase: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      setState({ phase: "error", message: "Error de red. Intenta de nuevo." });
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Registrar metadata del certificado
      </Button>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-md border p-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="font-semibold">Solo metadata — sin archivo real</p>
        <p className="mt-0.5">
          Registra los datos del certificado que ya tienes. El archivo .p12 y la contraseña{" "}
          <strong>no se suben aquí</strong>. La carga segura real se habilitará con almacenamiento
          cifrado en una fase posterior.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Nombre del archivo <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="certificado_firma.p12"
            value={certificateFileName}
            onChange={(e) => setCertificateFileName(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Fecha de vencimiento <span className="text-destructive">*</span>
          </label>
          <input
            type="date"
            required
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Emisor (opcional)</label>
          <input
            type="text"
            placeholder="Banco Central del Ecuador"
            value={issuerName}
            onChange={(e) => setIssuerName(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Sujeto (opcional)</label>
          <input
            type="text"
            placeholder="EMPRESA S.A. - RUC: 1234567890001"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Número de serie (opcional)
          </label>
          <input
            type="text"
            placeholder="3A:B2:..."
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Fingerprint SHA-256 (opcional)
          </label>
          <input
            type="text"
            placeholder="AA:BB:CC:..."
            value={fingerprintSha256}
            onChange={(e) => setFingerprintSha256(e.target.value)}
            className="w-full rounded-md border px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {state.phase === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={state.phase === "loading"}>
          {state.phase === "loading" ? "Guardando..." : "Guardar metadata"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setState({ phase: "idle" });
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
