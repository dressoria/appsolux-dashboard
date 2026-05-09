import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatQty(value: number | undefined) {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 4,
  }).format(value);
}

export default async function ErpInventoryStockPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver stock actual.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">
                Inventario
              </Link>{" "}
              / Stock actual
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Stock actual
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver stock actual.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const inventory = await getErpnextInventory();
  const noStockRows = inventory.filter((b) => (b.actual_qty ?? 0) <= 0);
  const withStockRows = inventory.filter((b) => (b.actual_qty ?? 0) > 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">
                Inventario
              </Link>{" "}
              / Stock actual
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Stock actual
            </h1>
            <p className="mt-2 text-muted-foreground">
              Cantidades disponibles, proyectadas y reservadas por producto y
              bodega.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryAdjustments}>
                Ajustar inventario
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryMovements}>Ver movimientos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventory}>Volver a inventario</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        {noStockRows.length > 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
            <span className="font-medium">
              {noStockRows.length}{" "}
              {noStockRows.length === 1
                ? "producto sin stock"
                : "productos sin stock"}
            </span>
            <span className="text-amber-600">
              — Revisa ajustes o ingresos de mercaderia
            </span>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Filas de stock</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {inventory.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Con stock</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {withStockRows.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sin stock</CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-semibold ${noStockRows.length > 0 ? "text-amber-600" : ""}`}
            >
              {noStockRows.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stock por producto y bodega</CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay stock registrado. Agrega stock desde la seccion de
                ajustes o mediante ingresos de mercaderia.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium">Bodega</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Disponible
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Proyectado
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Reservado
                      </th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventory.map((bin) => {
                      const qty = bin.actual_qty ?? 0;
                      const isNoStock = qty <= 0;
                      return (
                        <tr key={bin.name}>
                          <td className="py-2 pr-4 font-medium">
                            <Link
                              href={`${routes.erpInventoryKardex}?item=${encodeURIComponent(bin.item_code)}`}
                              className="hover:underline"
                            >
                              {bin.item_code}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {bin.warehouse}
                          </td>
                          <td
                            className={`py-2 pr-4 text-right font-semibold ${isNoStock ? "text-amber-600" : ""}`}
                          >
                            {formatQty(bin.actual_qty)}
                          </td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">
                            {formatQty(bin.projected_qty)}
                          </td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">
                            {formatQty(bin.reserved_qty)}
                          </td>
                          <td className="py-2">
                            {isNoStock ? (
                              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                                Sin stock
                              </span>
                            ) : (
                              <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                                Con stock
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
