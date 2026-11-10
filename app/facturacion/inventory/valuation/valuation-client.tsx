"use client";

import { Card, CardContent } from "@/components/ui/card";

type ValuationItem = {
  productId: string;
  productName: string;
  productCode: string | null;
  warehouseName: string;
  quantity: string;
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
          Método: <span className="font-medium">{method === "CURRENT_COST" ? "Costo actual del producto" : method === "WEIGHTED_AVERAGE" ? "Promedio ponderado" : method}</span>
        </p>
        <p className="text-sm font-medium">
          Valor total: <span className="text-lg">${totalValue}</span>
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E9F0] bg-[#F8F9FB]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Bodega</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Cantidad</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Costo unit.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {initialItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#667085]">
                    No hay productos con stock valorizado.
                  </td>
                </tr>
              ) : (
                initialItems.map((item, i) => (
                  <tr key={`${item.productId}-${i}`} className="border-b border-[#E4E9F0] last:border-0 hover:bg-[#F8F9FB] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#667085]">{item.productCode ?? "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-[#172033]">{item.productName}</td>
                    <td className="px-4 py-2.5 text-xs text-[#667085]">{item.warehouseName}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(item.quantity).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">${Number(item.unitCost).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">${Number(item.totalValue).toFixed(2)}</td>
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
