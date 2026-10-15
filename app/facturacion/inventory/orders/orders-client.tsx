"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Order = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  expectedDate: string | null;
  supplier: { name: string } | null;
  items: Array<{ id: string }>;
  notes: string | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-gray-100 text-gray-800" },
  SENT: { label: "Enviado", className: "bg-blue-100 text-blue-800" },
  PARTIAL: { label: "Parcial", className: "bg-yellow-100 text-yellow-800" },
  RECEIVED: { label: "Recibido", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelado", className: "bg-red-100 text-red-800" },
};

export function OrdersClient({
  initialOrders,
  initialTotal,
}: {
  initialOrders: Order[];
  initialTotal: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{initialTotal} pedido(s)</p>
        <Button
          onClick={async () => {
            const res = await fetch("/api/inventory/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: [] }),
            });
            if (res.ok) window.location.reload();
          }}
        >
          Nuevo pedido
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                <th className="px-4 py-3 text-center font-medium">Productos</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Fecha esperada</th>
                <th className="px-4 py-3 text-left font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {initialOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No hay pedidos de reposición.
                  </td>
                </tr>
              ) : (
                initialOrders.map((o) => {
                  const status = STATUS_LABELS[o.status] ?? { label: o.status, className: "bg-gray-100" };
                  return (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{o.number}</td>
                      <td className="px-4 py-2">{o.supplier?.name ?? "Sin proveedor"}</td>
                      <td className="px-4 py-2 text-center">{o.items.length}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {o.expectedDate ? new Date(o.expectedDate).toLocaleDateString("es-EC") : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs">{new Date(o.createdAt).toLocaleDateString("es-EC")}</td>
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
