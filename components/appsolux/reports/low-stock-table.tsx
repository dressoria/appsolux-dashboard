import { ReportsEmptyState } from "./reports-empty-state";
import type { LowStockReportItem } from "@/types/reports";

type LowStockTableProps = {
  items: LowStockReportItem[];
  emptyMessage: string;
};

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function LowStockTable({ items, emptyMessage }: LowStockTableProps) {
  if (items.length === 0) {
    return <ReportsEmptyState message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Producto</th>
            <th className="py-2 pr-4 font-medium">Bodega</th>
            <th className="py-2 pr-4 font-medium">Stock actual</th>
            <th className="py-2 font-medium">Proyectado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={`${item.item_code}-${item.warehouse}`}>
              <td className="py-2 pr-4 font-medium">{item.item_code}</td>
              <td className="py-2 pr-4">{item.warehouse}</td>
              <td className="py-2 pr-4">{formatQuantity(item.actual_qty)}</td>
              <td className="py-2">{formatQuantity(item.projected_qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
