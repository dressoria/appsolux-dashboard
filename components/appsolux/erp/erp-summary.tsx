import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ErpSummaryProps = {
  itemsCount: number;
  warehousesCount: number;
  customersCount: number;
  inventoryRowsCount: number;
};

export function ErpSummary({
  itemsCount,
  warehousesCount,
  customersCount,
  inventoryRowsCount,
}: ErpSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{itemsCount}</p>
          <p className="text-xs text-muted-foreground">Registros reales</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bodegas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{warehousesCount}</p>
          <p className="text-xs text-muted-foreground">Ubicaciones de stock</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{customersCount}</p>
          <p className="text-xs text-muted-foreground">Contactos comerciales</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{inventoryRowsCount}</p>
          <p className="text-xs text-muted-foreground">Filas de stock</p>
        </CardContent>
      </Card>
    </div>
  );
}
