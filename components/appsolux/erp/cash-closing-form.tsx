"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";

type Props = {
  date: string;
  expectedCashAmount: number;
  cashAccounts: Array<{ name: string; label: string }>;
};

type CashClosingResponse = ApiResponse<{
  closing: {
    id: string;
    status: string;
  };
}>;

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function CashClosingForm({
  date,
  expectedCashAmount,
  cashAccounts,
}: Props) {
  const router = useRouter();
  const [countedCashAmount, setCountedCashAmount] = useState("");
  const [cashAccountName, setCashAccountName] = useState(
    cashAccounts[0]?.name ?? ""
  );
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const difference = useMemo(() => {
    const counted = Number(countedCashAmount || 0);
    if (!Number.isFinite(counted)) return 0;
    return counted - expectedCashAmount;
  }, [countedCashAmount, expectedCashAmount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/finance/cash-closings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          cash_account_name: cashAccountName || undefined,
          counted_cash_amount: countedCashAmount,
          notes,
        }),
      });
      const result = (await response.json()) as CashClosingResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Cierre de caja registrado.");
      setCountedCashAmount("");
      setNotes("");
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("No se pudo registrar el cierre.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Cuenta caja</span>
          <select
            value={cashAccountName}
            onChange={(event) => setCashAccountName(event.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            {cashAccounts.length === 0 ? (
              <option value="">Sin cuenta caja seleccionada</option>
            ) : (
              cashAccounts.map((account) => (
                <option key={account.name} value={account.name}>
                  {account.label}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Efectivo contado</span>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={countedCashAmount}
            onChange={(event) => setCountedCashAmount(event.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm md:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Efectivo esperado</p>
          <p className="font-semibold">{formatMoney(expectedCashAmount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Efectivo contado</p>
          <p className="font-semibold">
            {formatMoney(Number(countedCashAmount || 0))}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Diferencia</p>
          <p
            className={cn(
              "font-semibold",
              difference < 0
                ? "text-rose-600"
                : difference > 0
                  ? "text-amber-600"
                  : "text-green-700"
            )}
          >
            {formatMoney(difference)}
          </p>
        </div>
      </div>

      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">Observaciones</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2"
          placeholder="Detalle de diferencia, arqueo o novedades del turno"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Registrar cierre"}
        </Button>
        {message ? (
          <p
            className={cn(
              "text-sm",
              isError ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
