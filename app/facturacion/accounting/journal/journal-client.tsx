"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type JournalLine = {
  id: string;
  debit: string;
  credit: string;
  description: string | null;
  account: { code: string; name: string };
};

type JournalEntry = {
  id: string;
  number: string;
  date: string;
  description: string;
  status: string;
  sourceType: string;
  totalDebit: string;
  totalCredit: string;
  lines: JournalLine[];
};

type Props = {
  initialEntries: JournalEntry[];
  totalPages: number;
  currentPage: number;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-yellow-100 text-yellow-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  REVERSED: { label: "Reversado", className: "bg-red-100 text-red-800" },
};

export function JournalClient({ initialEntries, totalPages, currentPage }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Página {currentPage} de {totalPages}
        </p>
        <Button
          onClick={() => {
            window.location.href = "/facturacion/accounting/journal?new=1";
          }}
        >
          Nuevo asiento
        </Button>
      </div>

      {initialEntries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No hay asientos contables registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {initialEntries.map((entry) => {
            const status = STATUS_LABELS[entry.status] ?? { label: entry.status, className: "bg-gray-100" };
            return (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{entry.number}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString("es-EC")} · {entry.sourceType}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>D: {Number(entry.totalDebit).toFixed(2)}</p>
                      <p>C: {Number(entry.totalCredit).toFixed(2)}</p>
                    </div>
                  </div>

                  <table className="mt-3 w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-1 text-left">Cuenta</th>
                        <th className="pb-1 text-left">Descripción</th>
                        <th className="pb-1 text-right">Débito</th>
                        <th className="pb-1 text-right">Crédito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="border-b last:border-0">
                          <td className="py-1 font-mono">{line.account.code} {line.account.name}</td>
                          <td className="py-1 text-muted-foreground">{line.description ?? ""}</td>
                          <td className="py-1 text-right">{Number(line.debit).toFixed(2)}</td>
                          <td className="py-1 text-right">{Number(line.credit).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
