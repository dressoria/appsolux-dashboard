"use client";

import { useRef, useState } from "react";
import { Upload, FileText, ImageIcon, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  planCode: string;
  planDisplayName: string;
  billingInterval: "MONTHLY" | "YEARLY";
  amount: number;
  accountNumber: string;
};

type FormStatus = "idle" | "submitting" | "success" | "error";

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="size-5 text-red-500" />;
  return <ImageIcon className="size-5 text-blue-500" />;
}

export function BankTransferForm({
  planCode,
  planDisplayName,
  billingInterval,
  amount,
  accountNumber,
}: Props) {
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim() || !file) return;

    setFormStatus("submitting");
    setErrorMessage(null);

    const formData = new FormData();
    formData.set("planCode", planCode);
    formData.set("billingInterval", billingInterval);
    formData.set("bankReference", reference.trim());
    formData.set("receipt", file);

    try {
      const res = await fetch("/api/billing/bank-transfer", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { ok: boolean; message?: string };

      if (!res.ok || !data.ok) {
        setFormStatus("error");
        setErrorMessage(data.message ?? "Error al enviar la solicitud.");
        return;
      }

      setFormStatus("success");
    } catch {
      setFormStatus("error");
      setErrorMessage("Error de conexión. Intenta de nuevo.");
    }
  }

  if (formStatus === "success") {
    return (
      <div className="rounded-2xl border border-facturom-primary/25 bg-facturom-primary/5 p-6 text-center">
        <h3 className="text-lg font-bold">Solicitud enviada</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Hemos recibido tu comprobante de transferencia. Nuestro equipo revisará el pago y, una vez
          aprobado, procederemos con la facturación de tu servicio y la activación del plan por el
          período contratado. Puedes consultar el estado de tu solicitud desde Facturom.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold">Datos de la transferencia</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Realiza una transferencia bancaria con los siguientes datos:
          </p>
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-semibold">{planDisplayName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Período</span>
            <span className="font-semibold">{billingInterval === "MONTHLY" ? "Mensual" : "Anual"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Importe</span>
            <span className="text-lg font-black text-facturom-primary">${amount} USD</span>
          </div>
        </div>

        <div className="rounded-xl border border-facturom-primary/20 bg-facturom-primary/5 p-4">
          <p className="text-sm font-semibold">Número de cuenta</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wide">{accountNumber}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Transfiere el monto exacto indicado arriba a esta cuenta.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <div>
          <h3 className="text-lg font-bold">Comprobante de pago</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Después de realizar la transferencia, sube el comprobante y el número de referencia.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bankReference">Número de referencia bancaria *</Label>
          <Input
            id="bankReference"
            placeholder="Ej: REF-2024-001234"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
            maxLength={100}
            disabled={formStatus === "submitting"}
          />
        </div>

        <div className="space-y-2">
          <Label>Comprobante de pago *</Label>
          <div
            className={cn(
              "rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors hover:border-facturom-primary/50 hover:bg-facturom-primary/5",
              file ? "border-facturom-primary/30 bg-facturom-primary/5" : "border-muted-foreground/25",
            )}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileIcon name={file.name} />
                <div className="text-left">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Haz clic para subir el comprobante</p>
                <p className="text-xs text-muted-foreground">PDF, JPG o PNG — máximo 10 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) setFile(selected);
            }}
            disabled={formStatus === "submitting"}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      ) : null}

      <Button
        className="w-full rounded-xl"
        disabled={!reference.trim() || !file || formStatus === "submitting"}
        type="submit"
      >
        {formStatus === "submitting" ? "Enviando…" : "Enviar comprobante"}
      </Button>
    </form>
  );
}
