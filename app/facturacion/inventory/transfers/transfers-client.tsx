"use client";

import { Card, CardContent } from "@/components/ui/card";

type Transfer = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  sourceWarehouse: { id: string; code: string; name: string };
  destinationWarehouse: { id: string; code: string; name: string };
  items: Array<{ productId: string; quantity: string; product: { name: string } }>;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-gray-100 text-gray-800" },
  PENDING: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "Completada", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", className: "bg-red-100 text-red-800" },
};

export function TransfersClient({ initialTransfers, initialTotal }: { initialTransfers: Transfer[]; initialTotal: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Número</th>
              <th className="px-4 py-3 text-left font-medium">Origen</th>
              <th className="px-4 py-3 text-left font-medium">Destino</th>
              <th className="px-4 py-3 text-center font-medium">Productos</th>
              <th className="px-4 py-3 text-center font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {initialTransfers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No hay transferencias.</td></tr>
            ) : initialTransfers.map((t) => {
              const status = STATUS_LABELS[t.status] ?? { label: t.status, className: "bg-gray-100" };
              return (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{t.number}</td>
                  <td className="px-4 py-2">{t.sourceWarehouse.name}</td>
                  <td className="px-4 py-2">{t.destinationWarehouse.name}</td>
                  <td className="px-4 py-2 text-center">{t.items.length}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">{new Date(t.createdAt).toLocaleDateString("es-EC")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">{initialTotal} transferencia(s)</div>
      </CardContent>
    </Card>
  );
}
