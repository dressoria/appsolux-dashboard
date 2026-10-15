"use client";

import { Card, CardContent } from "@/components/ui/card";

type ValuationItem = {
  productId: string;
  productName: string;
  primaryCode: string;
  totalQuantity: string;
  unitCost: string;
  totalValue: string;
};

export function ValuationClient({
  initialItems,
  totalValue,
  method,
}: {
  initialItems: ValuationItem[];
  totalValue: string;
  method: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Método: <span className="font-medium">{method === "WEIGHTED_AVERAGE" ? "Promedio ponderado" : method}</span>
        </p>
        <p className="text-sm font-medium">
          Valor total: <span className="text-lg">${totalValue}</span>
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                <th className="px-4 py-3 text-right font-medium">Costo unit.</th>
                <th className="px-4 py-3 text-right font-medium">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {initialItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No hay productos con stock valorizado.
                  </td>
                </tr>
              ) : (
                initialItems.map((item) => (
                  <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{item.primaryCode}</td>
                    <td className="px-4 py-2">{item.productName}</td>
                    <td className="px-4 py-2 text-right font-mono">{item.totalQuantity}</td>
                    <td className="px-4 py-2 text-right font-mono">${item.unitCost}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">${item.totalValue}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="border-t px-4 py-2 text-sm font-medium text-right">
            Total: ${totalValue}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
