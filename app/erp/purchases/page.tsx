import Link from "next/link";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { AdvancedModeBlockedCard } from "@/components/appsolux/dashboard/advanced-mode-blocked-card";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function getPurchasesBlockedDescription(
  erpProvisioning: Awaited<ReturnType<typeof getErpProvisioningState>>
) {
  if (erpProvisioning.isSimulated) {
    return "La validacion tecnica termino, pero ERP/Compras seguiran bloqueados hasta completar el provisioning real.";
  }
  if (erpProvisioning.isPending || erpProvisioning.isFailed) {
    return erpProvisioning.displayStatus;
  }
  if (erpProvisioning.status === "not_configured") {
    return "El modulo de compras necesita un ERP dedicado activo para consultar proveedores, compras y facturas recibidas.";
  }

  return erpProvisioning.displayStatus;
}

export default async function ErpPurchasesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el modulo de compras.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);
  const erpProvisioning = tenantMode.erpProvisioning;

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Compras
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Compras y proveedores
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {getPurchasesBlockedDescription(erpProvisioning)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>

          <ErpDedicatedProvisionCard
            provisioning={erpProvisioning}
            canManage={canManageSettings(user)}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />

          <AdvancedModeBlockedCard
            title="Modulo de compras bloqueado"
            erpProvisioning={erpProvisioning}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Compras
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Compras y proveedores
            </h1>
            <p className="mt-2 text-muted-foreground">
              Gestiona proveedores, compras, ingresos de mercaderia y cuentas
              por pagar desde el ERP.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={routes.erp}>Volver al ERP</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Flujo de compras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                  1
                </span>
                <div>
                  <span className="font-medium">Registra el proveedor</span>
                  <p className="text-muted-foreground">
                    Agrega el nombre, RUC, email y tipo de proveedor.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                  2
                </span>
                <div>
                  <span className="font-medium">
                    Crea una compra o factura recibida
                  </span>
                  <p className="text-muted-foreground">
                    Registra lo que compraste: productos, cantidades y precios.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                  3
                </span>
                <div>
                  <span className="font-medium">
                    Registra el ingreso de mercaderia
                  </span>
                  <p className="text-muted-foreground">
                    Confirma la entrada fisica al stock de tu bodega.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                  4
                </span>
                <div>
                  <span className="font-medium">Gestiona cuentas por pagar</span>
                  <p className="text-muted-foreground">
                    Revisa facturas pendientes y registra pagos al proveedor.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                  5
                </span>
                <div>
                  <span className="font-medium">
                    Consulta reportes de compras
                  </span>
                  <p className="text-muted-foreground">
                    Analiza lo que compraste, a quien y cuanto pagaste.
                  </p>
                </div>
              </li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild>
                <Link href={routes.erpPurchasesSuppliers}>
                  Ver proveedores
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpPurchasesDocuments}>Compras</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpPurchasesReceipts}>
                  Ingresos de mercaderia
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpPurchasesPayables}>
                  Cuentas por pagar
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpPurchasesSupplierBalances}>
                  Proveedores con saldo
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.reports}>Reportes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="hover:bg-muted/30 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Proveedores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Directorio de proveedores con datos de contacto e identificacion
                fiscal.
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href={routes.erpPurchasesSuppliers}>Ver proveedores</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/30 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">
                Compras y facturas recibidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ordenes de compra y facturas recibidas de proveedores.
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href={routes.erpPurchasesDocuments}>Ver compras</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/30 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Ingresos de mercaderia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Recepciones de productos comprados registradas en bodega.
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href={routes.erpPurchasesReceipts}>Ver ingresos</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/30 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">Cuentas por pagar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Facturas de compra pendientes de pago a proveedores.
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href={routes.erpPurchasesPayables}>Ver pendientes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
