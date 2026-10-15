"use client";

import { Card, CardContent } from "@/components/ui/card";

type Movement = {
  id: string;
  date: string;
  direction: string;
  quantity: string;
  movementType: string;
  reference: string | null;
  unitCost: string | null;
  product: { id: string; name: string; primaryCode: string | null };
  warehouse: { id: string; code: string; name: string };
};

const TYPE_LABELS: Record<string, string> = {
  OPENING: "Apertura",
  SALE: "Venta",
  SALE_RETURN: "Dev. venta",
  PURCHASE_RECEIPT: "Compra",
  PURCHASE_RETURN: "Dev. compra",
  TRANSFER_IN: "Transfer. entrada",
  TRANSFER_OUT: "Transfer. salida",
  PHYSICAL_COUNT: "Conteo físico",
  ADJUSTMENT_IN: "Ajuste entrada",
  ADJUSTMENT_OUT: "Ajuste salida",
  COMBO_CONSUMPTION: "Consumo combo",
  OTHER: "Otro",
};

export function MovementsClient({
  initialMovements,
  initialTotal,
}: {
  initialMovements: Movement[];
  initialTotal: number;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Producto</th>
              <th className="px-4 py-3 text-left font-medium">Bodega</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-right font-medium">Entrada</th>
              <th className="px-4 py-3 text-right font-medium">Salida</th>
              <th className="px-4 py-3 text-right font-medium">Costo unit.</th>
              <th className="px-4 py-3 text-left font-medium">Referencia</th>
            </tr>
          </thead>
          <tbody>
            {initialMovements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No hay movimientos registrados.
                </td>
              </tr>
            ) : (
              initialMovements.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs">{new Date(m.date).toLocaleDateString("es-EC")}</td>
                  <td className="px-4 py-2">{m.product.name}</td>
                  <td className="px-4 py-2 text-xs">{m.warehouse.name}</td>
                  <td className="px-4 py-2 text-xs">{TYPE_LABELS[m.movementType] ?? m.movementType}</td>
                  <td className="px-4 py-2 text-right font-mono">{m.direction === "IN" ? Number(m.quantity).toFixed(2) : ""}</td>
                  <td className="px-4 py-2 text-right font-mono">{m.direction === "OUT" ? Number(m.quantity).toFixed(2) : ""}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{m.unitCost ? `$${Number(m.unitCost).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-2 text-xs">{m.reference ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {initialTotal} movimiento(s) total
        </div>
      </CardContent>
    </Card>
  );
}
