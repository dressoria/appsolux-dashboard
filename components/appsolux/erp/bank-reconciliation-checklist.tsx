"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Movement = {
  name: string;
  posting_date?: string;
  payment_type?: string;
  party?: string;
  party_name?: string;
  mode_of_payment?: string;
  account?: string;
  amount: number;
  status?: string;
};

type Props = {
  movements: Movement[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function BankReconciliationChecklist({ movements }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const reviewedTotal = useMemo(
    () =>
      movements.reduce(
        (sum, movement) => sum + (checked[movement.name] ? movement.amount : 0),
        0
      ),
    [checked, movements]
  );
  const pendingTotal = movements.reduce((sum, movement) => {
    return sum + (!checked[movement.name] ? movement.amount : 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-sm text-muted-foreground">Movimientos revisados</p>
          <p className="text-xl font-semibold">
            {Object.values(checked).filter(Boolean).length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-sm text-muted-foreground">Total revisado</p>
          <p className="text-xl font-semibold text-green-700">
            {formatMoney(reviewedTotal)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-sm text-muted-foreground">Pendiente de revisar</p>
          <p className="text-xl font-semibold">{formatMoney(pendingTotal)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Revisado</th>
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Movimiento</th>
              <th className="py-2 pr-4 font-medium">Tercero</th>
              <th className="py-2 pr-4 font-medium">Metodo / cuenta</th>
              <th className="py-2 pr-4 font-medium">Tipo</th>
              <th className="py-2 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movements.map((movement) => {
              const isChecked = checked[movement.name] ?? false;
              return (
                <tr
                  key={movement.name}
                  className={cn(isChecked ? "bg-green-50/50" : "")}
                >
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) =>
                        setChecked((current) => ({
                          ...current,
                          [movement.name]: event.target.checked,
                        }))
                      }
                      aria-label={`Marcar ${movement.name} como revisado`}
                      className="h-4 w-4 rounded border"
                    />
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {movement.posting_date ?? "-"}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                    {movement.name}
                  </td>
                  <td className="py-2 pr-4">
                    {movement.party_name ?? movement.party ?? "-"}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {movement.mode_of_payment ?? movement.account ?? "-"}
                  </td>
                  <td className="py-2 pr-4">{movement.payment_type ?? "-"}</td>
                  <td className="py-2 text-right font-semibold">
                    {formatMoney(movement.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
