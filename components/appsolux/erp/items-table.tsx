import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErpnextItem } from "@/types/erpnext";

type ItemsTableProps = {
  items: ErpnextItem[];
};

function formatFlag(value: 0 | 1 | undefined) {
  return value === 1 ? "Si" : "No";
}

export function ItemsTable({ items }: ItemsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No hay productos en ERPNext. Crea el primer producto desde el
            formulario.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Codigo</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Unidad</th>
                  <th className="py-2 pr-4 font-medium">Stock</th>
                  <th className="py-2 font-medium">Deshabilitado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.name}>
                    <td className="py-2 pr-4 font-medium">{item.item_code}</td>
                    <td className="py-2 pr-4">{item.item_name}</td>
                    <td className="py-2 pr-4">{item.stock_uom ?? "-"}</td>
                    <td className="py-2 pr-4">
                      {formatFlag(item.is_stock_item)}
                    </td>
                    <td className="py-2">{formatFlag(item.disabled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
