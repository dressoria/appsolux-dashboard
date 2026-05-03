"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanSettingsErrorMessage } from "./settings-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextAccount, ErpnextCompany } from "@/types/erpnext";

type CreatePaymentAccountFormProps = {
  companies: ErpnextCompany[];
  defaultCompany?: string;
  defaultCurrency?: string;
};

type AccountResponse = ApiResponse<{
  account: ErpnextAccount;
}>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export function CreatePaymentAccountForm({
  companies,
  defaultCompany,
  defaultCurrency,
}: CreatePaymentAccountFormProps) {
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
      const response = await fetch("/api/erpnext/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_name: String(formData.get("account_name") ?? "").trim(),
          company: String(formData.get("company") ?? "").trim(),
          account_type: String(formData.get("account_type") ?? "").trim(),
          account_currency:
            String(formData.get("account_currency") ?? "").trim() || undefined,
        }),
      });
      const result = (await response.json()) as AccountResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(cleanSettingsErrorMessage(result.error.message));
        return;
      }

      setMessage("Cuenta creada correctamente.");
      form.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        cleanSettingsErrorMessage(
          error instanceof Error ? error.message : "No se pudo crear la cuenta"
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-3 rounded-lg border bg-background p-3" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-sm font-semibold">Crear cuenta caja/banco</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usa cuentas separadas para controlar cobros: Caja general, Banco
          Pichincha, Banco Guayaquil o Pagos por revisar.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="payment_account_name">Nombre</Label>
          <Input id="payment_account_name" name="account_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_account_company">Empresa</Label>
          <select
            id="payment_account_company"
            name="company"
            className={selectClassName}
            defaultValue={defaultCompany ?? ""}
            required
          >
            <option value="">Selecciona empresa</option>
            {companies.map((company) => (
              <option key={company.name} value={company.name}>
                {company.company_name ?? company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_account_type">Tipo</Label>
          <select
            id="payment_account_type"
            name="account_type"
            className={selectClassName}
            defaultValue="Cash"
            required
          >
            <option value="Cash">Caja / efectivo</option>
            <option value="Bank">Banco</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_account_currency">Moneda</Label>
          <Input
            id="payment_account_currency"
            name="account_currency"
            defaultValue={defaultCurrency ?? ""}
            placeholder="USD"
          />
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
        {isSubmitting ? "Creando..." : "Crear cuenta"}
      </Button>
    </form>
  );
}
