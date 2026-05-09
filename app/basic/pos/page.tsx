import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { BasicPosClient } from "@/components/appsolux/basic/pos-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPrismaClient } from "@/lib/db/prisma";
import { listCustomers, listProducts } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicPosPageProps = {
  searchParams: Promise<{ customerId?: string }>;
};

export default async function BasicPosPage({ searchParams }: BasicPosPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="POS basico"
        description="Venta rapida con stock automatico y recibo simple."
        activeHref={routes.basicPos}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedParams = await searchParams;
  const plan = await getTenantPlanState(tenant.id);

  const [products, customers] = await Promise.all([
    listProducts(tenant.id),
    listCustomers(tenant.id),
  ]);

  // Validate customerId belongs to this tenant
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

  if (!plan.canUseBasicPos) {
    return (
      <BasicModuleShell
        title="POS basico"
        description="Venta rapida con stock automatico y recibo simple."
        activeHref={routes.basicPos}
      >
        <Card>
          <CardHeader>
            <CardTitle>POS basico no disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Tu plan actual no incluye POS basico.
            </p>
          </CardContent>
        </Card>
      </BasicModuleShell>
    );
  }

  return (
    <BasicModuleShell
      title="POS basico"
      description="Selecciona productos, cobra o deja fiado, y entrega un recibo simple."
      activeHref={routes.basicPos}
    >
      <div className="space-y-6">
        <BasicPosClient
          tenantName={tenant.name}
          initialCustomerId={initialCustomerId}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price.toString(),
            stock: product.stock,
            barcode: product.barcode,
          }))}
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
          }))}
        />
      </div>
    </BasicModuleShell>
  );
}
