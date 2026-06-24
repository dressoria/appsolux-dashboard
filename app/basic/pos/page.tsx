import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { BasicPosClient } from "@/components/appsolux/basic/pos-client";
import { BillingWarehouseSelector } from "@/components/appsolux/billing/billing-warehouse-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { listCustomers, listProducts } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getSriModuleStatus } from "@/lib/core/sri";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { redirect } from "next/navigation";

type BasicPosPageProps = {
  searchParams: Promise<{ customerId?: string }>;
};

const compactActions = (
  <div className="flex flex-wrap gap-2">
    <Button asChild variant="outline" size="sm">
      <Link href={routes.basicSales}>Ver ventas</Link>
    </Button>
    <Button asChild variant="outline" size="sm">
      <Link href={routes.sriDocuments}>Facturas SRI</Link>
    </Button>
    <Button asChild variant="outline" size="sm">
      <Link href={routes.basicCash}>Caja</Link>
    </Button>
  </div>
);

export default async function BasicPosPage({ searchParams }: BasicPosPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="POS / Ventas"
        description="Vende, cobra y genera recibos o facturas desde un solo lugar."
        activeHref={routes.basicPos}
        action={compactActions}
      >
        <p className="text-muted-foreground">Sesión requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedParams = await searchParams;
  const plan = await getTenantPlanState(tenant.id);
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    redirect(routes.facturacionPos);
  }

  if (!plan.canUseBasicPos) {
    return (
      <BasicModuleShell
        title="POS / Ventas"
        description="Vende, cobra y genera recibos o facturas desde un solo lugar."
        activeHref={routes.basicPos}
        action={compactActions}
      >
        <Card>
          <CardHeader>
            <CardTitle>POS básico no disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Tu plan actual no incluye POS básico.
            </p>
          </CardContent>
        </Card>
      </BasicModuleShell>
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
    <BasicModuleShell
      title="POS / Ventas"
      description="Vende, cobra y genera recibos o facturas desde un solo lugar."
      activeHref={routes.basicPos}
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
  );
}
