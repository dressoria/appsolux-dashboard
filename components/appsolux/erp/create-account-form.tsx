"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { ErpnextAccount, ErpnextCompany } from "@/types/erpnext";

type Props = {
  companies: ErpnextCompany[];
  parentAccounts: ErpnextAccount[];
  defaultCompany?: string;
  defaultCurrency?: string;
};

type AccountResponse = ApiResponse<{ account: ErpnextAccount }>;

const inputClassName =
  "w-full rounded-md border bg-background px-3 py-2 text-sm";

export function CreateAccountForm({
  companies,
  parentAccounts,
  defaultCompany,
  defaultCurrency,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/erpnext/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "general",
          account_name: String(formData.get("account_name") ?? "").trim(),
          company: String(formData.get("company") ?? "").trim(),
          root_type: String(formData.get("root_type") ?? "").trim(),
          account_type: String(formData.get("account_type") ?? "").trim() || undefined,
          parent_account:
            String(formData.get("parent_account") ?? "").trim() || undefined,
          account_currency:
            String(formData.get("account_currency") ?? "").trim() || undefined,
        }),
      });
      const result = (await response.json()) as AccountResponse;
      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }
      setMessage("Cuenta creada.");
      form.reset();
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo crear la cuenta.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Crear cuenta contable</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea cuentas puntuales dentro del plan existente de ERPNext. No se
          genera un plan completo automaticamente.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Nombre</span>
          <input name="account_name" required className={inputClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Empresa</span>
          <select
            name="company"
            required
            defaultValue={defaultCompany ?? ""}
            className={inputClassName}
          >
            <option value="">Selecciona empresa</option>
            {companies.map((company) => (
              <option key={company.name} value={company.name}>
                {company.company_name ?? company.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Root type</span>
          <select name="root_type" required className={inputClassName}>
            <option value="">Selecciona</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Equity">Equity</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Tipo de cuenta</span>
          <input name="account_type" className={inputClassName} placeholder="Bank, Cash, Expense..." />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Cuenta padre</span>
          <select name="parent_account" className={inputClassName}>
            <option value="">ERPNext resolvera si aplica</option>
            {parentAccounts.map((account) => (
              <option key={account.name} value={account.name}>
                {account.account_name ?? account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Moneda</span>
          <input
            name="account_currency"
            defaultValue={defaultCurrency ?? ""}
            className={inputClassName}
            placeholder="USD"
          />
        </label>
      </div>
      {message ? (
        <p className={isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creando..." : "Crear cuenta"}
      </Button>
    </form>
  );
}
