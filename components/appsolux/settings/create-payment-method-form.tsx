"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanSettingsErrorMessage } from "./settings-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextModeOfPaymentDetail } from "@/types/erpnext";

type PaymentMethodResponse = ApiResponse<{
  mode_of_payment: ErpnextModeOfPaymentDetail;
}>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function CreatePaymentMethodForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(form);

    try {
      const response = await fetch("/api/erpnext/modes-of-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode_of_payment: String(formData.get("mode_of_payment") ?? "").trim(),
          type: String(formData.get("type") ?? "").trim() || undefined,
          enabled: true,
        }),
      });
      const result = (await response.json()) as PaymentMethodResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(cleanSettingsErrorMessage(result.error.message));
        return;
      }

      setMessage("Metodo de pago creado correctamente.");
      form.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        cleanSettingsErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo crear el metodo de pago"
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-3 rounded-lg border bg-background p-3" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-sm font-semibold">Crear metodo de pago</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ejemplos: Efectivo, Transferencia Banco Pichincha, Tarjeta o Pago por
          revisar.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          <Label htmlFor="mode_of_payment">Nombre</Label>
          <Input id="mode_of_payment" name="mode_of_payment" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mode_type">Tipo</Label>
          <select id="mode_type" name="type" className={selectClassName}>
            <option value="General">General</option>
            <option value="Cash">Caja / efectivo</option>
            <option value="Bank">Banco</option>
          </select>
        </div>
      </div>

      {message ? (
        <div
          className={
            isError
              ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
          }
        >
          {message}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creando..." : "Crear metodo"}
      </Button>
    </form>
  );
}
