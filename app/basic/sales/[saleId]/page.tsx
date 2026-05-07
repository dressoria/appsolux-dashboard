import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSaleById } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicSaleDetailPageProps = {
  params: Promise<{
    saleId: string;
  }>;
};

export default async function BasicSaleDetailPage({
  params,
}: BasicSaleDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { saleId } = await params;
  const sale = await getSaleById(tenant.id, saleId);

  if (!sale) {
    return (
      <DashboardShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Venta no encontrada.
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="print:hidden">
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Recibo simple
          </h1>
        </div>

        <SimpleReceipt
          tenantName={tenant.name}
          sale={{
            id: sale.id,
            createdAt: sale.createdAt,
            total: sale.total.toString(),
            status: sale.status,
            paymentStatus: sale.paymentStatus,
            customer: sale.customer ? { name: sale.customer.name } : null,
            items: sale.items.map((item) => ({
              quantity: item.quantity,
              price: item.price.toString(),
              total: item.total.toString(),
              product: { name: item.product.name },
            })),
            payments: sale.payments.map((payment) => ({
              method: payment.method,
              amount: payment.amount.toString(),
            })),
          }}
        />
      </div>
    </DashboardShell>
  );
}
