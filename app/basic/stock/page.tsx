import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listProducts, listStockMovements } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicStockPageProps = {
  searchParams: Promise<{
    productId?: string;
    type?: string;
  }>;
};

export default async function BasicStockPage({ searchParams }: BasicStockPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Movimientos de stock"
        description="Consulta entradas, salidas por venta y ajustes manuales."
        activeHref={routes.basicStock}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const type =
    resolvedSearchParams.type === "sale" ||
    resolvedSearchParams.type === "adjustment"
      ? resolvedSearchParams.type
      : undefined;
  const [products, movements] = await Promise.all([
    listProducts(tenant.id, { take: 50 }),
    listStockMovements(tenant.id, {
      productId: resolvedSearchParams.productId,
      type,
      take: 50,
    }),
  ]);

  return (
    <BasicModuleShell
      title="Movimientos de stock"
      description="Revisa los ultimos cambios de inventario por venta o ajuste."
      activeHref={routes.basicStock}
    >
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <select
              name="productId"
              defaultValue={resolvedSearchParams.productId ?? ""}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todos los productos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <select
              name="type"
              defaultValue={type ?? ""}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              <option value="sale">Ventas</option>
              <option value="adjustment">Ajustes</option>
            </select>
            <Button type="submit">Filtrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ultimos movimientos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {movements.map((movement) => (
            <div
              key={movement.id}
              className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto_auto_auto]"
            >
              <p className="font-medium">{movement.product.name}</p>
              <p className="text-muted-foreground">{movement.type}</p>
              <p className={movement.quantity < 0 ? "text-destructive" : "text-emerald-700"}>
                {movement.quantity > 0 ? "+" : ""}
                {movement.quantity}
              </p>
              <p className="text-xs text-muted-foreground">
                {movement.createdAt.toLocaleString("es-EC")} · stock actual {movement.product.stock}
              </p>
            </div>
          ))}
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavia no hay movimientos de stock. Ajusta stock o registra una venta para verlos aqui.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </BasicModuleShell>
  );
}
