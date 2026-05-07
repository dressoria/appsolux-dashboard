import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { SaleDetailActions } from "@/components/appsolux/basic/sale-detail-actions";
import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
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
      <BasicModuleShell
        title="Recibo simple"
        description="Inicia sesion para consultar la venta."
        activeHref={routes.basicSales}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const { saleId } = await params;
  const sale = await getSaleById(tenant.id, saleId);

  if (!sale) {
    return (
      <BasicModuleShell
        title="Recibo simple"
        description="Detalle de venta y comprobante simple."
        activeHref={routes.basicSales}
      >
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Venta no encontrada.
          </CardContent>
        </Card>
      </BasicModuleShell>
    );
  }

  const paid = sale.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );
  const pending = Math.max(Number(sale.total) - paid, 0);

  return (
    <BasicModuleShell
      title="Detalle de venta"
      description="Recibo simple, pagos, saldo pendiente y acciones de la venta."
      activeHref={routes.basicSales}
    >
      <SaleDetailActions
        saleId={sale.id}
        canCancel={sale.status !== "canceled"}
        canPay={sale.status !== "canceled" && pending > 0}
        pendingAmount={pending}
      />

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
    </BasicModuleShell>
  );
}
