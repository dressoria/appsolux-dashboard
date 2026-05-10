import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextStockLedger } from "@/lib/api/erpnext/stock-ledger";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

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

function formatQty(value: number | undefined) {
  if (value === undefined) return "-";
  const formatted = new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 4,
    signDisplay: "exceptZero",
  }).format(value);
  return formatted;
}

export default async function ErpInventoryMovementsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver movimientos de inventario.
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
              / Movimientos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Movimientos de inventario
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>
                El ERP dedicado es necesario para ver movimientos de inventario.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const entries = await getErpnextStockLedger();

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
              / Movimientos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Movimientos de inventario
            </h1>
            <p className="mt-2 text-muted-foreground">
              Historial de entradas, salidas, ajustes y movimientos de stock.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryKardex}>Ver kardex</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryStock}>Ver stock</Link>
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
          Los ingresos o transferencias en borrador no aparecen aqui hasta ser confirmados en el
          ERP.
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ultimos movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay movimientos de inventario registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium">Bodega</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Movimiento
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Saldo
                      </th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      <th className="py-2 font-medium">Referencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entries.map((entry) => {
                      const qty = entry.actual_qty ?? 0;
                      const isPositive = qty > 0;
                      return (
                        <tr key={entry.name}>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {entry.posting_date ?? "-"}
                          </td>
                          <td className="py-2 pr-4 font-medium">
                            <Link
                              href={`${routes.erpInventoryKardex}?item=${encodeURIComponent(entry.item_code)}`}
                              className="hover:underline"
                            >
                              {entry.item_code}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {entry.warehouse}
                          </td>
                          <td
                            className={`py-2 pr-4 text-right font-semibold ${
                              isPositive
                                ? "text-green-700"
                                : qty < 0
                                  ? "text-rose-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {formatQty(entry.actual_qty)}
                          </td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">
                            {formatQty(entry.qty_after_transaction)}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-600">
                              {getVoucherLabel(entry.voucher_type)}
                            </span>
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
      </div>
    </DashboardShell>
  );
}
