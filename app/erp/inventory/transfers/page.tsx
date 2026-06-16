import Link from "next/link";
import { CreateStockTransferDialog } from "@/components/appsolux/erp/create-stock-transfer-dialog";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextStockTransfers } from "@/lib/api/erpnext/stock-entries";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function getDocstatusLabel(docstatus?: 0 | 1 | 2) {
  if (docstatus === 2) return "Anulado";
  if (docstatus === 1) return "Aplicado";
  return "Borrador";
}

export default async function ErpInventoryTransfersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver transferencias.</p>
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
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">Inventario</Link>{" "}
              / Transferencias
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Transferencias entre bodegas</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para registrar transferencias.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [warehouses, items, inventory, transfers] = await Promise.all([
    getErpnextWarehouses().catch(() => []),
    getErpnextItems().catch(() => []),
    getErpnextInventory().catch(() => []),
    getErpnextStockTransfers().catch(() => []),
  ]);

  const operativeWarehouses = warehouses.filter(
    (w) => w.is_group !== 1 && w.disabled !== 1
  );
  const stockItems = items.filter((i) => i.disabled !== 1 && i.is_stock_item !== 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">Inventario</Link>{" "}
              / Transferencias
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Transferencias entre bodegas
            </h1>
            <p className="mt-2 text-muted-foreground">
              Mueve productos de una bodega a otra manteniendo trazabilidad completa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryStock}>Ver stock</Link>
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

        {operativeWarehouses.length < 2 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            Necesitas al menos dos bodegas operativas para registrar transferencias.{" "}
            <Link href={routes.erpInventoryWarehouses} className="underline underline-offset-2">
              Crea una bodega
            </Link>{" "}
            adicional.
          </div>
        ) : null}

        {stockItems.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No hay productos de inventario registrados.{" "}
            <Link href={routes.erpInventoryProducts} className="underline underline-offset-2">
              Crea productos
            </Link>{" "}
            antes de registrar transferencias.
          </div>
        ) : null}

        {inventory.length === 0 && stockItems.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
            No hay stock registrado. Ingresa mercaderia o aplica ajustes para poder transferir
            productos.
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <CreateStockTransferDialog warehouses={warehouses} items={items} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          La transferencia se aplica de inmediato en el ERP. El stock de la bodega origen disminuye
          y el de la bodega destino aumenta. Puedes consultar el movimiento en{" "}
          <Link href={routes.erpInventoryMovements} className="underline underline-offset-2">
            Movimientos
          </Link>
          .
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transferencias recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay transferencias registradas. Usa el boton{" "}
                <span className="font-medium">Nueva transferencia</span> para crear la primera.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Documento</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Bodega origen</th>
                      <th className="py-2 pr-4 font-medium">Bodega destino</th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transfers.map((t) => (
                      <tr key={t.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {t.name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {t.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">{t.from_warehouse ?? "-"}</td>
                        <td className="py-2 pr-4">{t.to_warehouse ?? "-"}</td>
                        <td className="py-2">
                          <span
                            className={`inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium ${
                              t.docstatus === 1
                                ? "border-green-200 bg-green-50 text-green-700"
                                : t.docstatus === 2
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            {getDocstatusLabel(t.docstatus)}
                          </span>
                        </td>
                      </tr>
                    ))}
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
