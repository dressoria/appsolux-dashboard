import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextStockLedger } from "@/lib/api/erpnext/stock-ledger";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

type KardexPageProps = {
  searchParams: { item?: string; warehouse?: string };
};

function formatBalance(value: number | undefined) {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatMoney(value: number | undefined) {
  if (value === undefined) return "-";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getVoucherLabel(voucherType?: string) {
  if (!voucherType) return "Movimiento";
  const t = voucherType.toLowerCase();
  if (t.includes("sales invoice")) return "Venta";
  if (t.includes("purchase invoice")) return "Compra";
  if (t.includes("purchase receipt")) return "Ingreso";
  if (t.includes("delivery note")) return "Entrega";
  if (t.includes("stock entry")) return "Ajuste";
  if (t.includes("stock reconciliation")) return "Toma fisica";
  return voucherType;
}

export default async function ErpInventoryKardexPage({
  searchParams,
}: KardexPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el kardex.
          </p>
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
              / Kardex
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Kardex</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el kardex.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const selectedItem = searchParams.item ?? null;
  const selectedWarehouse = searchParams.warehouse ?? null;

  const [items, entries] = await Promise.all([
    getErpnextItems(),
    selectedItem
      ? getErpnextStockLedger({
          item_code: selectedItem,
          warehouse: selectedWarehouse ?? undefined,
        })
      : Promise.resolve([]),
  ]);

  const selectedItemDetail = selectedItem
    ? items.find((i) => i.item_code === selectedItem)
    : null;

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
              / Kardex
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Kardex por producto
            </h1>
            <p className="mt-2 text-muted-foreground">
              Movimientos detallados con saldo acumulado para un producto
              especifico.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryMovements}>
                Todos los movimientos
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventory}>Volver a inventario</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        {!selectedItem ? (
          <Card>
            <CardHeader>
              <CardTitle>Selecciona un producto</CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Aun no hay productos registrados en el ERP.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Codigo</th>
                        <th className="py-2 pr-4 font-medium">Nombre</th>
                        <th className="py-2 pr-4 font-medium">Categoria</th>
                        <th className="py-2 font-medium">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item) => (
                        <tr key={item.name}>
                          <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                            {item.item_code}
                          </td>
                          <td className="py-2 pr-4 font-medium">
                            {item.item_name}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {item.item_group ?? "-"}
                          </td>
                          <td className="py-2">
                            <Link
                              href={`${routes.erpInventoryKardex}?item=${encodeURIComponent(item.item_code)}`}
                              className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              Ver kardex
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Link
                href={routes.erpInventoryKardex}
                className="rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                ← Cambiar producto
              </Link>
              <div>
                <span className="text-sm text-muted-foreground">Producto:</span>{" "}
                <span className="font-semibold">
                  {selectedItemDetail
                    ? `${selectedItemDetail.item_name} (${selectedItem})`
                    : selectedItem}
                </span>
                {selectedWarehouse ? (
                  <>
                    <span className="mx-2 text-muted-foreground">/</span>
                    <span className="text-sm text-muted-foreground">
                      Bodega:
                    </span>{" "}
                    <span className="font-semibold">{selectedWarehouse}</span>
                  </>
                ) : null}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Movimientos del producto</CardTitle>
              </CardHeader>
              <CardContent>
                {entries.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    No hay movimientos registrados para este producto.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Fecha</th>
                          <th className="py-2 pr-4 font-medium">Bodega</th>
                          <th className="py-2 pr-4 font-medium text-right">
                            Entrada
                          </th>
                          <th className="py-2 pr-4 font-medium text-right">
                            Salida
                          </th>
                          <th className="py-2 pr-4 font-medium text-right">
                            Saldo
                          </th>
                          <th className="py-2 pr-4 font-medium">Tipo</th>
                          <th className="py-2 pr-4 font-medium text-right">
                            Valoracion
                          </th>
                          <th className="py-2 font-medium">Referencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {entries.map((entry) => {
                          const qty = entry.actual_qty ?? 0;
                          return (
                            <tr key={entry.name}>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {entry.posting_date ?? "-"}
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {entry.warehouse}
                              </td>
                              <td className="py-2 pr-4 text-right font-semibold text-green-700">
                                {qty > 0 ? formatBalance(qty) : "-"}
                              </td>
                              <td className="py-2 pr-4 text-right font-semibold text-rose-600">
                                {qty < 0 ? formatBalance(Math.abs(qty)) : "-"}
                              </td>
                              <td className="py-2 pr-4 text-right font-medium">
                                {formatBalance(entry.qty_after_transaction)}
                              </td>
                              <td className="py-2 pr-4">
                                <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-600">
                                  {getVoucherLabel(entry.voucher_type)}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-right text-muted-foreground">
                                {formatMoney(entry.valuation_rate)}
                              </td>
                              <td className="py-2 font-mono text-xs text-muted-foreground">
                                {entry.voucher_no ?? "-"}
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
          </>
        )}
      </div>
    </DashboardShell>
  );
}
