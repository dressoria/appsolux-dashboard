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

type StockPageProps = {
  searchParams: { filter?: string };
};

export default async function ErpInventoryStockPage({ searchParams }: StockPageProps) {
  const filter = searchParams.filter ?? "all";
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

  const LOW_STOCK_THRESHOLD = 5;

  const inventory = await getErpnextInventory();
  const noStockRows = inventory.filter((b) => (b.actual_qty ?? 0) <= 0);
  const withStockRows = inventory.filter((b) => (b.actual_qty ?? 0) > 0);
  const lowStockRows = withStockRows.filter((b) => (b.actual_qty ?? 0) <= LOW_STOCK_THRESHOLD);

  const displayRows =
    filter === "out"
      ? noStockRows
      : filter === "low"
        ? lowStockRows
        : inventory;

  const pageTitle =
    filter === "out"
      ? "Stock actual — Sin stock"
      : filter === "low"
        ? "Stock actual — Stock bajo"
        : "Stock actual";

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
            <h1 className="text-3xl font-semibold tracking-tight">{pageTitle}</h1>
            <p className="mt-2 text-muted-foreground">
              Cantidades disponibles, proyectadas y reservadas por producto y bodega.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryAdjustments}>Ajustar inventario</Link>
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

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          Los ingresos o transferencias en borrador no afectan el stock hasta ser confirmados en el
          ERP.
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`${routes.erpInventoryStock}`}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              filter === "all" || filter === undefined || filter === ""
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-input bg-background hover:bg-muted"
            }`}
          >
            Todos ({inventory.length})
          </Link>
          <Link
            href={`${routes.erpInventoryStock}?filter=out`}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              filter === "out"
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-input bg-background hover:bg-muted"
            }`}
          >
            Sin stock ({noStockRows.length})
          </Link>
          <Link
            href={`${routes.erpInventoryStock}?filter=low`}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              filter === "low"
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-input bg-background hover:bg-muted"
            }`}
          >
            Stock bajo ({lowStockRows.length})
          </Link>
        </div>

        {filter === "low" ? (
          <p className="text-xs text-muted-foreground">
            Stock bajo: productos con cantidad disponible entre 1 y {LOW_STOCK_THRESHOLD} unidades (estimado). Para umbrales exactos configura nivel de reorden en el ERP.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Filas de stock</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{inventory.length}</CardContent>
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
            <CardTitle>
              {filter === "out"
                ? "Productos sin stock"
                : filter === "low"
                  ? "Productos con stock bajo"
                  : "Stock por producto y bodega"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayRows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {filter === "out"
                  ? "No hay productos sin stock en este momento."
                  : filter === "low"
                    ? "No hay productos con stock bajo en este momento."
                    : "Aun no hay stock registrado. Agrega stock desde ajustes o ingresos de mercaderia."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium">Bodega</th>
                      <th className="py-2 pr-4 font-medium text-right">Disponible</th>
                      <th className="py-2 pr-4 font-medium text-right">Proyectado</th>
                      <th className="py-2 pr-4 font-medium text-right">Reservado</th>
                      <th className="py-2 font-medium">Estado</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayRows.map((bin) => {
                      const qty = bin.actual_qty ?? 0;
                      const isNoStock = qty <= 0;
                      const isLow = qty > 0 && qty <= LOW_STOCK_THRESHOLD;
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
                          <td className="py-2 pr-4 text-muted-foreground">{bin.warehouse}</td>
                          <td
                            className={`py-2 pr-4 text-right font-semibold ${
                              isNoStock ? "text-amber-600" : isLow ? "text-orange-600" : ""
                            }`}
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
                            ) : isLow ? (
                              <span className="inline-flex h-5 items-center rounded-full border border-orange-200 bg-orange-50 px-2 text-xs font-medium text-orange-700">
                                Stock bajo
                              </span>
                            ) : (
                              <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                                Con stock
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1.5">
                              <Button asChild size="xs" variant="outline">
                                <Link
                                  href={`${routes.erpInventoryAdjustments}?item=${encodeURIComponent(
                                    bin.item_code
                                  )}&warehouse=${encodeURIComponent(bin.warehouse)}`}
                                >
                                  Ajustar
                                </Link>
                              </Button>
                              <Button asChild size="xs" variant="outline">
                                <Link
                                  href={`${routes.erpInventoryKardex}?item=${encodeURIComponent(
                                    bin.item_code
                                  )}&warehouse=${encodeURIComponent(bin.warehouse)}`}
                                >
                                  Kardex
                                </Link>
                              </Button>
                              <Button asChild size="xs" variant="outline">
                                <Link href={routes.erpInventoryTransfers}>
                                  Transferir
                                </Link>
                              </Button>
                            </div>
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
