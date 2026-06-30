import Link from "next/link";

import { AdvancedPosPage } from "@/components/appsolux/facturacion/advanced-pos-page";
import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { BasicPosClient } from "@/components/appsolux/basic/pos-client";
import { BillingWarehouseSelector } from "@/components/appsolux/billing/billing-warehouse-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { routes } from "@/config/routes";
import { getPrismaClient } from "@/lib/db/prisma";
import { listCustomers, listProducts } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getSriModuleStatus } from "@/lib/core/sri";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionPosPageProps = {
  searchParams: Promise<{ customerId?: string }>;
};

const compactActions = (
  <div className="flex flex-wrap gap-2">
    <Button asChild variant="outline" size="sm">
      <Link href={routes.facturacionDocuments}>Ver ventas</Link>
    </Button>
    <Button asChild variant="outline" size="sm">
      <Link href={routes.sriDocuments}>Facturas SRI</Link>
    </Button>
    <Button asChild variant="outline" size="sm">
      <Link href={routes.facturacionCash}>Caja</Link>
    </Button>
  </div>
);

export default async function FacturacionPosPage({ searchParams }: FacturacionPosPageProps) {
  const { user, tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <AdvancedPosPage />;
  }

  const [resolvedParams, plan] = await Promise.all([
    searchParams,
    getTenantPlanState(tenant.id),
  ]);

  if (!plan.canUseBasicPos) {
    return (
      <DashboardShell mainClassName="" contentClassName="">
        <BasicModuleShell
          title="POS / Ventas"
          description="Vende, cobra y genera recibos o facturas desde un solo lugar."
          activeHref={routes.facturacionPos}
          action={compactActions}
        >
          <Card>
            <CardHeader>
              <CardTitle>POS no disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Tu plan actual no incluye POS.
              </p>
            </CardContent>
          </Card>
        </BasicModuleShell>
      </DashboardShell>
    );
  }

  const [products, customers, sriStatus] = await Promise.all([
    listProducts(tenant.id),
    listCustomers(tenant.id),
    getSriModuleStatus(tenant.id),
  ]);

  const hasSriConfig =
    sriStatus.hasProfile &&
    sriStatus.establishmentCount > 0 &&
    sriStatus.issuePointCount > 0 &&
    sriStatus.sequenceCount > 0;

  let initialCustomerId = "";
  const rawCustomerId = resolvedParams.customerId ?? "";
  if (rawCustomerId) {
    const prisma = getPrismaClient();
    const found = await prisma.lightweightCustomer.findFirst({
      where: { id: rawCustomerId, tenantId: tenant.id },
      select: { id: true },
    });
    if (found) initialCustomerId = found.id;
  }

  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicModuleShell
        title="POS / Ventas"
        description="Vende, cobra y genera recibos o facturas desde un solo lugar."
        activeHref={routes.facturacionPos}
        action={compactActions}
      >
        <div className="space-y-4">
          <BillingWarehouseSelector />
          <BasicPosClient
            tenantName={tenant.name}
            currentUserName={user.name}
            hasSriConfig={hasSriConfig}
            initialCustomerId={initialCustomerId}
            products={products.map((product) => ({
              id: product.id,
              name: product.name,
              price: product.price.toString(),
              stock: product.stock,
              barcode: product.barcode,
              taxRate: product.taxRate.toString(),
            }))}
            customers={customers.map((customer) => ({
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
            }))}
          />
        </div>
      </BasicModuleShell>
    </DashboardShell>
  );
}
