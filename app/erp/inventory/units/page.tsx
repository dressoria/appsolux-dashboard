import Link from "next/link";
import { UomManager } from "@/components/appsolux/erp/uom-manager";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextUoms } from "@/lib/api/erpnext/uoms";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpInventoryUnitsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver unidades.
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
              / Unidades
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Unidades de medida
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para gestionar unidades.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const uoms = await getErpnextUoms().catch(() => []);

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
              / Unidades
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Unidades de medida
            </h1>
            <p className="mt-2 text-muted-foreground">
              Administra UOM reales de ERPNext para compras, stock y ventas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryProducts}>Productos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventoryCategories}>Categorias</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpInventory}>Volver a inventario</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Unidades registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <UomManager uoms={uoms} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
