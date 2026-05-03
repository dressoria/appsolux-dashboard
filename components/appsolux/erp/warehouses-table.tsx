import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErpnextWarehouse } from "@/types/erpnext";

type WarehousesTableProps = {
  warehouses: ErpnextWarehouse[];
};

function formatFlag(value: 0 | 1 | undefined) {
  return value === 1 ? "Si" : "No";
}

export function WarehousesTable({ warehouses }: WarehousesTableProps) {
  const sortedWarehouses = [...warehouses].sort((left, right) => {
    const leftIsGroup = left.is_group === 1 ? 1 : 0;
    const rightIsGroup = right.is_group === 1 ? 1 : 0;

    if (leftIsGroup !== rightIsGroup) {
      return leftIsGroup - rightIsGroup;
    }

    return left.warehouse_name.localeCompare(right.warehouse_name);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bodegas</CardTitle>
      </CardHeader>
      <CardContent>
        {warehouses.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No hay bodegas disponibles. Configura una bodega en ERPNext o crea
            una mediante la API interna.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Las bodegas de grupo organizan la estructura y no se usan
              directamente para movimientos de stock.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Bodega</th>
                    <th className="py-2 pr-4 font-medium">Empresa</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 font-medium">Deshabilitada</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedWarehouses.map((warehouse) => (
                    <tr key={warehouse.name}>
                      <td className="py-2 pr-4 font-medium">
                        {warehouse.warehouse_name}
                      </td>
                      <td className="py-2 pr-4">{warehouse.company ?? "-"}</td>
                      <td className="py-2 pr-4">
                        {warehouse.is_group === 1 ? "Grupo" : "Bodega usable"}
                      </td>
                      <td className="py-2">{formatFlag(warehouse.disabled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
