"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CostCenter = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  active: boolean;
  parentId: string | null;
};

type Props = {
  initialCenters: CostCenter[];
};

const TYPE_LABELS: Record<string, string> = {
  COST_CENTER: "Centro de costo",
  PROJECT: "Proyecto",
};

export function CostCentersClient({ initialCenters }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { window.location.href = "/facturacion/accounting/cost-centers?new=1"; }}>
          Nuevo centro
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {initialCenters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No hay centros de costo configurados.
                  </td>
                </tr>
              ) : (
                initialCenters.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {TYPE_LABELS[c.type] ?? c.type}
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
