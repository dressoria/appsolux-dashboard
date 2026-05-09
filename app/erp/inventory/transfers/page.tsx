import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";

export default function ErpInventoryTransfersPage() {
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
              / Transferencias
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Transferencias entre bodegas
            </h1>
            <p className="mt-2 text-muted-foreground">
              Mueve productos entre sucursales, mostradores o bodegas centrales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Transferencias entre bodegas</CardTitle>
              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                En preparacion
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Las transferencias permiten mover productos de una bodega a otra
              manteniendo trazabilidad completa de los movimientos.
            </p>
            <p className="text-sm text-muted-foreground">
              Casos de uso: mover stock desde bodega central a sucursal,
              redistribuir productos entre locales, o preparar pedidos internos.
            </p>
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              El flujo de transferencias entre bodegas estara disponible
              proximamente.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={routes.erpInventoryStock}>
                  Ver stock actual mientras tanto
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpInventoryMovements}>
                  Ver historial de movimientos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
