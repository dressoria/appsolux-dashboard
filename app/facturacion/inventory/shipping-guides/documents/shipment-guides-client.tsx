"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ShipmentGuide = {
  id: string;
  number: string;
  status: string;
  recipientName: string;
  recipientId: string;
  originAddress: string;
  destinationAddress: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  vehicle: { plate: string } | null;
  items: Array<{ id: string }>;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-gray-100 text-gray-800" },
  ISSUED: { label: "Emitida", className: "bg-green-100 text-green-800" },
  REFERRAL_GUIDE_SRI_PENDING: { label: "SRI pendiente", className: "bg-yellow-100 text-yellow-800" },
  CANCELLED: { label: "Anulada", className: "bg-red-100 text-red-800" },
};

export function ShipmentGuidesClient({
  initialGuides,
  initialTotal,
}: {
  initialGuides: ShipmentGuide[];
  initialTotal: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{initialTotal} guía(s)</p>
        <Link href="/facturacion/inventory/shipping-guides/documents/new">
          <Button>Nueva guía de remisión</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Destinatario</th>
                <th className="px-4 py-3 text-left font-medium">Origen</th>
                <th className="px-4 py-3 text-left font-medium">Destino</th>
                <th className="px-4 py-3 text-center font-medium">Vehículo</th>
                <th className="px-4 py-3 text-center font-medium">Productos</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {initialGuides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No hay guías de remisión.
                  </td>
                </tr>
              ) : (
                initialGuides.map((g) => {
                  const status = STATUS_LABELS[g.status] ?? { label: g.status, className: "bg-gray-100" };
                  return (
                    <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{g.number}</td>
                      <td className="px-4 py-2">{g.recipientName}</td>
                      <td className="px-4 py-2 text-xs">{g.originAddress}</td>
                      <td className="px-4 py-2 text-xs">{g.destinationAddress}</td>
                      <td className="px-4 py-2 text-center text-xs">{g.vehicle?.plate ?? "—"}</td>
                      <td className="px-4 py-2 text-center">{g.items.length}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">{new Date(g.createdAt).toLocaleDateString("es-EC")}</td>
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
