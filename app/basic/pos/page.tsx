import { BasicPosClient } from "@/components/appsolux/basic/pos-client";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCustomers, listProducts } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function BasicPosPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const plan = await getTenantPlanState(tenant.id);
  const [products, customers] = await Promise.all([
    listProducts(tenant.id),
    listCustomers(tenant.id),
  ]);

  if (!plan.canUseBasicPos) {
    return (
      <DashboardShell>
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
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">POS basico</h1>
          <p className="mt-2 text-muted-foreground">
            Venta rapida con stock automatico y recibo simple.
          </p>
        </div>

        <BasicPosClient
          tenantName={tenant.name}
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
    </DashboardShell>
  );
}
