import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value);
}

function formatQty(value: number) {
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 4 }).format(value);
}

export default async function ErpInventoryValuationPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver inventario valorizado.</p>
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
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">Inventario</Link>{" "}
              / Valorizado
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Inventario valorizado</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver inventario valorizado.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const inventory = await getErpnextInventory().catch(() => []);

  const rows = inventory.filter((b) => (b.actual_qty ?? 0) > 0);
  const hasValuationData = rows.some(
    (b) => (b.stock_value ?? 0) > 0 || (b.valuation_rate ?? 0) > 0
  );

  const totalValue = rows.reduce((sum, b) => {
    if ((b.stock_value ?? 0) > 0) return sum + (b.stock_value ?? 0);
    if ((b.valuation_rate ?? 0) > 0)
      return sum + (b.valuation_rate ?? 0) * (b.actual_qty ?? 0);
    return sum;
  }, 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">Inventario</Link>{" "}
              / Valorizado
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Inventario valorizado</h1>
            <p className="mt-2 text-muted-foreground">
              Valor total del inventario en stock calculado por costo promedio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryStock}>Ver stock</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventory}>Volver a inventario</Link>
            </Button>
          </div>
        </div>

        {hasValuationData ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Valor total en stock</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-violet-700">
                {formatMoney(totalValue)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Productos con stock</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{rows.length}</CardContent>
            </Card>
          </div>
        ) : null}

        {!hasValuationData && rows.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            Hay stock registrado pero sin datos de valoracion todavia. La valoracion depende de que
            los ingresos o ajustes tengan costo configurado. Ingresa mercaderia con costo unitario
            desde{" "}
            <Link href={routes.erpPurchasesReceipts} className="underline underline-offset-2">
              Ingresos de mercaderia
            </Link>{" "}
            para comenzar a ver el inventario valorizado.
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Detalle por producto y bodega</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay stock registrado con cantidad mayor a 0. Ingresa mercaderia para ver el
                inventario valorizado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium">Bodega</th>
                      <th className="py-2 pr-4 text-right font-medium">Cantidad</th>
                      <th className="py-2 pr-4 text-right font-medium">Costo promedio</th>
                      <th className="py-2 text-right font-medium">Valor total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((bin) => {
                      const valuationRate = bin.valuation_rate ?? 0;
                      const qty = bin.actual_qty ?? 0;
                      const stockValue =
                        (bin.stock_value ?? 0) > 0
                          ? (bin.stock_value ?? 0)
                          : valuationRate * qty;
                      const hasValue = stockValue > 0 || valuationRate > 0;
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
                          <td className="py-2 pr-4 text-right">{formatQty(qty)}</td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">
                            {hasValue ? formatMoney(valuationRate) : "-"}
                          </td>
                          <td className="py-2 text-right font-semibold">
                            {hasValue ? (
                              <span className="text-violet-700">{formatMoney(stockValue)}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Sin costo</span>
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

        {rows.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
            El costo promedio se calcula automaticamente por ERPNext al recibir mercaderia con costo
            configurado. Los ajustes sin costo no afectan la valoracion.
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
