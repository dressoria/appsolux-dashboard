import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErpnextBin } from "@/types/erpnext";

type InventoryTableProps = {
  inventory: ErpnextBin[];
};

function formatQuantity(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function InventoryTable({ inventory }: InventoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario / Stock</CardTitle>
      </CardHeader>
      <CardContent>
        {inventory.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            ERPNext no tiene filas de inventario todavia. Crea productos y una
            entrada de stock para empezar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Producto</th>
                  <th className="py-2 pr-4 font-medium">Bodega</th>
                  <th className="py-2 pr-4 font-medium">Actual</th>
                  <th className="py-2 pr-4 font-medium">Reservado</th>
                  <th className="py-2 font-medium">Proyectado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventory.map((bin) => (
                  <tr key={bin.name}>
                    <td className="py-2 pr-4 font-medium">{bin.item_code}</td>
                    <td className="py-2 pr-4">{bin.warehouse}</td>
                    <td className="py-2 pr-4">
                      {formatQuantity(bin.actual_qty)}
                    </td>
                    <td className="py-2 pr-4">
                      {formatQuantity(bin.reserved_qty)}
                    </td>
                    <td className="py-2">
                      {formatQuantity(bin.projected_qty)}
                    </td>
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
