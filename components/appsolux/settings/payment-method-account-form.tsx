"use client";

import { useState } from "react";
import { cleanSettingsErrorMessage } from "./settings-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextAccount,
  ErpnextModeOfPaymentDetail,
  PaymentAccountMapping,
} from "@/types/erpnext";

type PaymentMethodAccountFormProps = {
  modesOfPayment: ErpnextModeOfPaymentDetail[];
  accounts: ErpnextAccount[];
  company?: string;
};

type MappingResponse = ApiResponse<{
  mapping: PaymentAccountMapping;
}>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function getMappedAccount(
  modeOfPayment: ErpnextModeOfPaymentDetail,
  company?: string
) {
  const accountRow = modeOfPayment.accounts?.find(
    (row) => row.company === company
  );

  return accountRow?.default_account ?? accountRow?.account ?? "";
}

export function PaymentMethodAccountForm({
  modesOfPayment,
  accounts,
  company,
}: PaymentMethodAccountFormProps) {
  const [selectedAccounts, setSelectedAccounts] = useState(() =>
    Object.fromEntries(
      modesOfPayment.map((modeOfPayment) => [
        modeOfPayment.name,
        getMappedAccount(modeOfPayment, company),
      ])
    )
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [savingMode, setSavingMode] = useState<string | null>(null);

  async function saveMapping(modeOfPayment: string) {
    if (!company) {
      setIsError(true);
      setMessage("Selecciona una empresa para asociar cuentas.");
      return;
    }

    const account = selectedAccounts[modeOfPayment]?.trim();

    if (!account) {
      setIsError(true);
      setMessage("Selecciona una cuenta de caja o banco.");
      return;
    }

    setSavingMode(modeOfPayment);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(
        `/api/erpnext/modes-of-payment/${encodeURIComponent(
          modeOfPayment
        )}/accounts`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, account }),
        }
      );
      const result = (await response.json()) as MappingResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(cleanSettingsErrorMessage(result.error.message));
        return;
      }

      setMessage(`Cuenta asociada a ${modeOfPayment}.`);
    } catch (error) {
      setIsError(true);
      setMessage(
        cleanSettingsErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo asociar la cuenta"
        )
      );
    } finally {
      setSavingMode(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metodos de pago</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cada metodo de pago debe tener una cuenta de caja o banco. Ejemplo:
          Efectivo a Caja general, Transferencia a Banco Pichincha.
        </p>

        {!company ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No hay empresa principal para configurar pagos.
          </div>
        ) : null}

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No hay cuentas de caja o banco disponibles. Primero configura el
            plan de cuentas de la empresa.
          </div>
        ) : null}

        {modesOfPayment.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No hay metodos de pago configurados.
          </div>
        ) : null}

        <div className="space-y-3">
          {modesOfPayment.map((modeOfPayment) => {
            const selectedAccount = selectedAccounts[modeOfPayment.name] ?? "";

            return (
              <div
                key={modeOfPayment.name}
                className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[1fr_1.5fr_auto]"
              >
                <div>
                  <p className="font-medium">{modeOfPayment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAccount
                      ? "Cuenta asociada para registrar cobros."
                      : "Este metodo no podra registrar cobros hasta asociar una cuenta."}
                  </p>
                </div>
                <select
                  className={selectClassName}
                  value={selectedAccount}
                  onChange={(event) =>
                    setSelectedAccounts((current) => ({
                      ...current,
                      [modeOfPayment.name]: event.target.value,
                    }))
                  }
                  disabled={!company || accounts.length === 0}
                >
                  <option value="">Selecciona cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.name} value={account.name}>
                      {account.account_name ?? account.name} -{" "}
                      {account.account_type ?? "Cuenta"} (
                      {account.account_currency ?? "-"})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !company ||
                    accounts.length === 0 ||
                    savingMode === modeOfPayment.name
                  }
                  onClick={() => saveMapping(modeOfPayment.name)}
                >
                  {savingMode === modeOfPayment.name ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            );
          })}
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
      </CardContent>
    </Card>
  );
}
