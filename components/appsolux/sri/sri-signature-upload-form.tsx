"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type UploadState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; message: string }
  | { phase: "error"; message: string };

export function SriSignatureUploadForm() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setState({ phase: "error", message: "Selecciona un certificado .p12 o .pfx." });
      return;
    }

    setState({ phase: "loading" });

    try {
      const formData = new FormData();
      formData.set("certificate", file);
      formData.set("password", password);

      const response = await fetch("/api/sri/signature/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { error?: string; status?: string };
      if (!response.ok) {
        setState({ phase: "error", message: data.error ?? "No se pudo cargar el certificado." });
        return;
      }

      setPassword("");
      setFile(null);
      setState({
        phase: "success",
        message:
          data.status === "READY_FOR_TESTING"
            ? "Firma electrónica lista."
            : "Certificado cargado. Revisa el titular y vencimiento antes de emitir.",
      });
      router.refresh();
    } catch {
      setState({ phase: "error", message: "Error de red. Intenta nuevamente." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 p-4">
      <div className="rounded-xl bg-[#eee5f7] p-3 text-xs text-facturom-primary">
        Sube tu certificado .p12 o .pfx. El archivo y la contraseña se cifran en el servidor y no se devuelven al navegador.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Certificado <span className="text-destructive">*</span>
          </label>
          <input
            type="file"
            accept=".p12,.pfx,application/x-pkcs12"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">Maximo 5 MB. Solo .p12 o .pfx.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Contrasena del certificado <span className="text-destructive">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Se cifra antes de guardarse y no vuelve a mostrarse en dashboard.
          </p>
        </div>
      </div>

      {state.phase === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.phase === "success" && <p className="text-sm text-emerald-700">{state.message}</p>}

      <Button type="submit" size="sm" disabled={state.phase === "loading"}>
        {state.phase === "loading" ? "Guardando…" : "Guardar firma electrónica"}
      </Button>
    </form>
  );
}
