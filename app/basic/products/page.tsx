import { ProductForm } from "@/components/appsolux/basic/product-form";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listProducts } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function BasicProductsPage() {
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
  const products = await listProducts(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-2 text-muted-foreground">
            {products.length} / {plan.limits.products} productos del plan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo producto</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario basico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto_auto]"
              >
                <p className="font-medium">{product.name}</p>
                <p className="text-muted-foreground">
                  ${product.price.toString()}
                </p>
                <p className="text-muted-foreground">Stock: {product.stock}</p>
              </div>
            ))}
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aun no hay productos.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
