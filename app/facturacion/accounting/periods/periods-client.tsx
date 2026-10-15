"use client";

import { Card, CardContent } from "@/components/ui/card";

type Period = {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: string | null;
};

type Props = {
  initialPeriods: Period[];
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Abierto", className: "bg-green-100 text-green-800" },
  CLOSED: { label: "Cerrado", className: "bg-yellow-100 text-yellow-800" },
  LOCKED: { label: "Bloqueado", className: "bg-red-100 text-red-800" },
};

const MONTH_NAMES = [
  "Anual", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function PeriodsClient({ initialPeriods }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Año</th>
              <th className="px-4 py-3 text-left font-medium">Período</th>
              <th className="px-4 py-3 text-left font-medium">Inicio</th>
              <th className="px-4 py-3 text-left font-medium">Fin</th>
              <th className="px-4 py-3 text-center font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Cerrado</th>
            </tr>
          </thead>
          <tbody>
            {initialPeriods.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No hay períodos contables. Se crean automáticamente al configurar la contabilidad.
                </td>
              </tr>
            ) : (
              initialPeriods.map((p) => {
                const status = STATUS_LABELS[p.status] ?? { label: p.status, className: "bg-gray-100" };
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-semibold">{p.year}</td>
                    <td className="px-4 py-2">{MONTH_NAMES[p.month] ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{new Date(p.startDate).toLocaleDateString("es-EC")}</td>
                    <td className="px-4 py-2 text-xs">{new Date(p.endDate).toLocaleDateString("es-EC")}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {p.closedAt ? new Date(p.closedAt).toLocaleDateString("es-EC") : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
