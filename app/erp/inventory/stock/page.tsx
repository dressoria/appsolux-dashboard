import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantPreferredWarehouseName } from "@/lib/core/business-suite/erpnext-master-data";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function formatQty(value: number | undefined) {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 4,
  }).format(value);
}

type StockPageProps = {
  searchParams: Promise<{ filter?: string; warehouse?: string }>;
};

type ProductStockRow = {
  itemCode: string;
  itemName: string;
  totalQty: number;
  projectedQty: number;
  reservedQty: number;
  selectedWarehouseQty: number;
  warehouses: Array<{
    name: string;
    qty: number;
  }>;
};

export default async function ErpInventoryStockPage({ searchParams }: StockPageProps) {
  const params = await searchParams;
  const filter = params.filter ?? "all";
  const warehouseFilter = params.warehouse ?? "all";
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver stock actual.</p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
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
            <h1 className="text-3xl font-semibold tracking-tight">Stock actual</h1>
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

  const [inventory, items, warehouses, preferredWarehouseName] = await Promise.all([
    getErpnextInventory(),
    getErpnextItems(),
    getErpnextWarehouses(),
    getTenantPreferredWarehouseName(tenant.id),
  ]);

  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1
  );
  const validWarehouseFilter =
    warehouseFilter !== "all" &&
    activeWarehouses.some((warehouse) => warehouse.name === warehouseFilter)
      ? warehouseFilter
      : "all";

  const itemNameByCode = new Map(
    items.map((item) => [item.item_code, item.item_name || item.item_code])
  );

  const rowsByItem = inventory.reduce<Map<string, ProductStockRow>>((acc, bin) => {
    const existing = acc.get(bin.item_code) ?? {
      itemCode: bin.item_code,
      itemName: itemNameByCode.get(bin.item_code) ?? bin.item_code,
      totalQty: 0,
      projectedQty: 0,
      reservedQty: 0,
      selectedWarehouseQty: 0,
      warehouses: [],
    };

    const qty = bin.actual_qty ?? 0;
    existing.totalQty += qty;
    existing.projectedQty += bin.projected_qty ?? 0;
    existing.reservedQty += bin.reserved_qty ?? 0;
    if (validWarehouseFilter !== "all" && bin.warehouse === validWarehouseFilter) {
      existing.selectedWarehouseQty += qty;
    }
    existing.warehouses.push({
      name: bin.warehouse,
      qty,
    });

    acc.set(bin.item_code, existing);
    return acc;
  }, new Map());

  const allRows = Array.from(rowsByItem.values())
    .map((row) => ({
      ...row,
      warehouses: row.warehouses.sort((a, b) => b.qty - a.qty),
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName, "es"));

  const getVisibleQty = (row: ProductStockRow) =>
    validWarehouseFilter === "all" ? row.totalQty : row.selectedWarehouseQty;

  const noStockRows = allRows.filter((row) => getVisibleQty(row) <= 0);
  const withStockRows = allRows.filter((row) => getVisibleQty(row) > 0);
  const lowStockRows = withStockRows.filter(
    (row) => getVisibleQty(row) <= LOW_STOCK_THRESHOLD
  );

  const displayRows =
    filter === "out"
      ? noStockRows
      : filter === "low"
        ? lowStockRows
        : allRows;

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
              Revisa stock total y por bodega para cada producto operativo.
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
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          {validWarehouseFilter === "all"
            ? "La vista consolida el stock de todas las bodegas activas."
            : `Mostrando disponibilidad operativa para la bodega ${validWarehouseFilter}.`}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={validWarehouseFilter === "all" ? routes.erpInventoryStock : `${routes.erpInventoryStock}?warehouse=${encodeURIComponent(validWarehouseFilter)}`}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              filter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-input bg-background hover:bg-muted"
            }`}
          >
            Todos ({allRows.length})
          </Link>
          <Link
            href={`${routes.erpInventoryStock}?filter=low${validWarehouseFilter === "all" ? "" : `&warehouse=${encodeURIComponent(validWarehouseFilter)}`}`}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              filter === "low" ? "border-amber-500 bg-amber-500 text-white" : "border-input bg-background hover:bg-muted"
            }`}
          >
            Stock bajo ({lowStockRows.length})
          </Link>
          <Link
            href={`${routes.erpInventoryStock}?filter=out${validWarehouseFilter === "all" ? "" : `&warehouse=${encodeURIComponent(validWarehouseFilter)}`}`}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              filter === "out" ? "border-amber-600 bg-amber-600 text-white" : "border-input bg-background hover:bg-muted"
            }`}
          >
            Sin stock ({noStockRows.length})
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={filter === "all" ? routes.erpInventoryStock : `${routes.erpInventoryStock}?filter=${encodeURIComponent(filter)}`}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              validWarehouseFilter === "all" ? "border-sky-700 bg-sky-700 text-white" : "border-input bg-background hover:bg-muted"
            }`}
          >
            Todas las bodegas
          </Link>
          {activeWarehouses.map((warehouse) => {
            const href =
              filter === "all"
                ? `${routes.erpInventoryStock}?warehouse=${encodeURIComponent(warehouse.name)}`
                : `${routes.erpInventoryStock}?filter=${encodeURIComponent(filter)}&warehouse=${encodeURIComponent(warehouse.name)}`;

            const active = validWarehouseFilter === warehouse.name;

            return (
              <Link
                key={warehouse.name}
                href={href}
                className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-input bg-background hover:bg-muted"
                }`}
              >
                {warehouse.warehouse_name || warehouse.name}
                {preferredWarehouseName === warehouse.name ? " · Principal" : ""}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{allRows.length}</CardContent>
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
              {validWarehouseFilter === "all"
                ? "Stock consolidado por producto"
                : `Stock por producto en ${validWarehouseFilter}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayRows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay productos para este filtro.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        {validWarehouseFilter === "all" ? "Stock total" : "Stock en bodega"}
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">Proyectado</th>
                      <th className="py-2 pr-4 font-medium text-right">Reservado</th>
                      <th className="py-2 pr-4 font-medium">Stock por bodega</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayRows.map((row) => {
                      const qty = getVisibleQty(row);
                      const isNoStock = qty <= 0;
                      const isLow = qty > 0 && qty <= LOW_STOCK_THRESHOLD;

                      return (
                        <tr key={row.itemCode}>
                          <td className="py-2 pr-4">
                            <Link
                              href={`${routes.erpInventoryKardex}?item=${encodeURIComponent(row.itemCode)}`}
                              className="font-medium hover:underline"
                            >
                              {row.itemName}
                            </Link>
                            <p className="text-xs text-muted-foreground">{row.itemCode}</p>
                          </td>
                          <td
                            className={`py-2 pr-4 text-right font-semibold ${
                              isNoStock ? "text-amber-600" : isLow ? "text-orange-600" : ""
                            }`}
                          >
                            {formatQty(qty)}
                          </td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">
                            {formatQty(row.projectedQty)}
                          </td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">
                            {formatQty(row.reservedQty)}
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap gap-1.5">
                              {row.warehouses.map((warehouse) => (
                                <span
                                  key={`${row.itemCode}-${warehouse.name}`}
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                                    preferredWarehouseName === warehouse.name
                                      ? "border-sky-200 bg-sky-50 text-sky-700"
                                      : "border-slate-200 bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  {warehouse.name}: {formatQty(warehouse.qty)}
                                  {preferredWarehouseName === warehouse.name ? " · Principal" : ""}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
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
                                  href={`${routes.erpInventoryAdjustments}?item=${encodeURIComponent(row.itemCode)}${validWarehouseFilter === "all" ? "" : `&warehouse=${encodeURIComponent(validWarehouseFilter)}`}`}
                                >
                                  Ajustar
                                </Link>
                              </Button>
                              <Button asChild size="xs" variant="outline">
                                <Link
                                  href={`${routes.erpInventoryKardex}?item=${encodeURIComponent(row.itemCode)}${validWarehouseFilter === "all" ? "" : `&warehouse=${encodeURIComponent(validWarehouseFilter)}`}`}
                                >
                                  Kardex
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
