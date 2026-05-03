import { ReportsEmptyState } from "./reports-empty-state";
import type { ProductSalesReportItem } from "@/types/reports";

type TopProductsTableProps = {
  products: ProductSalesReportItem[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function TopProductsTable({ products }: TopProductsTableProps) {
  if (products.length === 0) {
    return (
      <ReportsEmptyState message="Aun no hay productos vendidos en facturas reales." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Producto</th>
            <th className="py-2 pr-4 font-medium">Cantidad vendida</th>
            <th className="py-2 font-medium">Total vendido</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((product) => (
            <tr key={product.item_code}>
              <td className="py-2 pr-4">
                <p className="font-medium">
                  {product.item_name ?? product.item_code}
                </p>
                <p className="text-xs text-muted-foreground">
                  {product.item_code}
                </p>
              </td>
              <td className="py-2 pr-4">
                {formatQuantity(product.qty_sold)}
              </td>
              <td className="py-2">{formatMoney(product.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
