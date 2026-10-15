"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PhysicalCount = {
  id: string;
  number: string;
  status: string;
  warehouseId: string;
  warehouse: { id: string; name: string };
  createdAt: string;
  completedAt: string | null;
  items: Array<{
    id: string;
    productId: string;
    product: { name: string; primaryCode: string };
    expectedQuantity: string;
    countedQuantity: string | null;
    difference: string;
  }>;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-gray-100 text-gray-800" },
  IN_PROGRESS: { label: "En progreso", className: "bg-blue-100 text-blue-800" },
  COMPLETED: { label: "Completado", className: "bg-green-100 text-green-800" },
};

export function PhysicalCountClient({
  initialCounts,
  initialTotal,
}: {
  initialCounts: PhysicalCount[];
  initialTotal: number;
}) {
  const [counts] = useState(initialCounts);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{initialTotal} toma(s) física(s)</p>
        <Button
          onClick={async () => {
            const res = await fetch("/api/inventory/physical-counts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            if (res.ok) window.location.reload();
          }}
        >
          Nueva toma física
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Bodega</th>
                <th className="px-4 py-3 text-center font-medium">Productos</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {counts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No hay tomas físicas registradas.
                  </td>
                </tr>
              ) : (
                counts.map((c) => {
                  const status = STATUS_LABELS[c.status] ?? { label: c.status, className: "bg-gray-100" };
                  return (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    >
                      <td className="px-4 py-2 font-mono text-xs">{c.number}</td>
                      <td className="px-4 py-2">{c.warehouse.name}</td>
                      <td className="px-4 py-2 text-center">{c.items.length}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">{new Date(c.createdAt).toLocaleDateString("es-EC")}</td>
                      <td className="px-4 py-2 text-center">
                        {c.status !== "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await fetch(`/api/inventory/physical-counts/${c.id}/complete`, {
                                method: "POST",
                              });
                              if (res.ok) window.location.reload();
                            }}
                          >
                            Completar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
