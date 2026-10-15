"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Concept = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  costAccount: { code: string; name: string } | null;
  expenseAccount: { code: string; name: string } | null;
};

type Props = {
  initialConcepts: Concept[];
};

export function CostsExpensesClient({ initialConcepts }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { window.location.href = "/facturacion/accounting/costs-expenses?new=1"; }}>
          Nuevo concepto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Cuenta costo</th>
                <th className="px-4 py-3 text-left font-medium">Cuenta gasto</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {initialConcepts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No hay conceptos de costo/gasto configurados.
                  </td>
                </tr>
              ) : (
                initialConcepts.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {c.costAccount ? `${c.costAccount.code} ${c.costAccount.name}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {c.expenseAccount ? `${c.expenseAccount.code} ${c.expenseAccount.name}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-center text-xs">
                      {c.active ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">Activo</span>
                      ) : (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">Inactivo</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
