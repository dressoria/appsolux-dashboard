import { CreateWarehouseForm } from "./create-warehouse-form";
import { WarehouseActions } from "./warehouse-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErpnextCompany, ErpnextWarehouse } from "@/types/erpnext";

type WarehousesSettingsCardProps = {
  warehouses: ErpnextWarehouse[];
  companies: ErpnextCompany[];
  defaultCompany?: string;
};

export function WarehousesSettingsCard({
  warehouses,
  companies,
  defaultCompany,
}: WarehousesSettingsCardProps) {
  const usableWarehouses = warehouses.filter(
    (warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1
  );
  const groupWarehouses = warehouses.filter(
    (warehouse) => warehouse.is_group === 1
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>ERP y bodegas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Las bodegas son ubicaciones donde guardas productos: local,
            sucursal, mostrador o bodega central.
          </p>
          <p>
            Las bodegas utilizables reciben stock. Las bodegas de grupo solo
            organizan la estructura.
          </p>
          <p>
            Si una bodega ya tiene movimientos, no se elimina para conservar el
            historial; puedes desactivarla.
          </p>
        </div>

        <CreateWarehouseForm
          companies={companies}
          parentWarehouses={groupWarehouses}
          defaultCompany={defaultCompany}
        />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Bodegas utilizables</h2>
          {usableWarehouses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No hay bodegas utilizables configuradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Bodega</th>
                    <th className="py-2 pr-4 font-medium">Empresa</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usableWarehouses.map((warehouse) => (
                    <tr key={warehouse.name}>
                      <td className="py-2 pr-4 font-medium">
                        {warehouse.warehouse_name}
                      </td>
                      <td className="py-2 pr-4">{warehouse.company ?? "-"}</td>
                      <td className="py-2 pr-4">Utilizable</td>
                      <td className="py-2">
                        <WarehouseActions warehouse={warehouse} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {groupWarehouses.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">
              Bodegas de grupo / estructura
            </h2>
            <div className="flex flex-wrap gap-2">
              {groupWarehouses.map((warehouse) => (
                <span
                  key={warehouse.name}
                  className="inline-flex h-7 items-center rounded-full border bg-muted px-3 text-xs text-muted-foreground"
                >
                  {warehouse.warehouse_name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
