"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { ErpnextAccount } from "@/types/erpnext";

type Props = {
  account: ErpnextAccount;
  parentAccounts: ErpnextAccount[];
};

type AccountResponse = ApiResponse<{ account: ErpnextAccount }>;

const inputClassName =
  "w-full rounded-md border bg-background px-3 py-2 text-sm";

export function AccountActions({ account, parentAccounts }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"edit" | "disable" | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(payload: Record<string, unknown>) {
    setIsPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/erpnext/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: account.name, ...payload }),
      });
      const result = (await response.json()) as AccountResponse;
      if (!result.success) {
        setMessage(result.error.message);
        return;
      }
      setMode(null);
      router.refresh();
    } catch {
      setMessage("No se pudo actualizar la cuenta.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await submit({
      account_name: String(formData.get("account_name") ?? "").trim(),
      account_type: String(formData.get("account_type") ?? "").trim() || undefined,
      account_currency:
        String(formData.get("account_currency") ?? "").trim() || undefined,
      parent_account:
        String(formData.get("parent_account") ?? "").trim() || undefined,
    });
  }

  return (
    <div className="relative flex flex-wrap gap-1.5">
      <Button type="button" size="xs" variant="outline" onClick={() => setMode("edit")}>
        Editar
      </Button>
      {account.disabled !== 1 ? (
        <Button type="button" size="xs" variant="outline" onClick={() => setMode("disable")}>
          Desactivar
        </Button>
      ) : null}

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-card p-4 shadow-lg">
            {mode === "edit" ? (
              <>
                <h2 className="text-lg font-semibold">Editar cuenta</h2>
                <form className="mt-4 space-y-3" onSubmit={handleEdit}>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Nombre</span>
                    <input
                      name="account_name"
                      required
                      defaultValue={account.account_name ?? account.name}
                      className={inputClassName}
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">Tipo</span>
                      <input
                        name="account_type"
                        defaultValue={account.account_type ?? ""}
                        className={inputClassName}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">Moneda</span>
                      <input
                        name="account_currency"
                        defaultValue={account.account_currency ?? ""}
                        className={inputClassName}
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Cuenta padre</span>
                    <select
                      name="parent_account"
                      defaultValue={account.parent_account ?? ""}
                      className={inputClassName}
                    >
                      <option value="">Sin cambio</option>
                      {parentAccounts.map((parent) => (
                        <option key={parent.name} value={parent.name}>
                          {parent.account_name ?? parent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {message ? <p className="text-sm text-destructive">{message}</p> : null}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setMode(null)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Desactivar cuenta</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  ERPNext puede bloquear la desactivacion si la cuenta tiene
                  movimientos o dependencias. No se eliminara la cuenta.
                </p>
                {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setMode(null)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => submit({ action: "disable" })}
                  >
                    {isPending ? "Desactivando..." : "Desactivar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
