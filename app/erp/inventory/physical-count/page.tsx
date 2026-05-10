import Link from "next/link";
import { PhysicalCountTable } from "@/components/appsolux/erp/physical-count-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpInventoryPhysicalCountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para realizar toma fisica.</p>
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
              / Toma fisica
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Toma fisica</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para realizar toma fisica.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [items, warehouses, inventory] = await Promise.all([
    getErpnextItems().catch(() => []),
    getErpnextWarehouses().catch(() => []),
    getErpnextInventory().catch(() => []),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpInventory} className="hover:underline">Inventario</Link>{" "}
              / Toma fisica
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Toma fisica de inventario</h1>
            <p className="mt-2 text-muted-foreground">
              Compara el conteo real con el stock del sistema y aplica ajustes por diferencias.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryAdjustments}>Ajustes individuales</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryStock}>Ver stock</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventory}>Volver a inventario</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            <p>
              La toma fisica permite comparar el conteo real con el stock del sistema. Selecciona
              una bodega, ingresa las cantidades contadas y aplica ajustes para corregir diferencias.
              Cada ajuste genera un movimiento trazable en el historial.
            </p>
          </CardContent>
        </Card>

        {warehouses.filter((w) => w.is_group !== 1 && w.disabled !== 1).length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No hay bodegas operativas.{" "}
            <Link href={routes.erpInventoryWarehouses} className="underline underline-offset-2">
              Crea una bodega
            </Link>{" "}
            antes de realizar la toma fisica.
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No hay productos registrados.{" "}
            <Link href={routes.erpInventoryProducts} className="underline underline-offset-2">
              Crea productos
            </Link>{" "}
            primero.
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Conteo por bodega</CardTitle>
          </CardHeader>
          <CardContent>
            <PhysicalCountTable
              items={items}
              warehouses={warehouses}
              inventory={inventory}
            />
          </CardContent>
        </Card>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-muted-foreground">
          Para ajustes masivos desde un archivo CSV, usa la seccion{" "}
          <Link href={routes.erpInventoryAdjustments} className="underline underline-offset-2">
            Ajuste masivo
          </Link>{" "}
          en la pagina de ajustes.
        </div>
      </div>
    </DashboardShell>
  );
}
